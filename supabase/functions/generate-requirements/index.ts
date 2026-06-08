import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { LAW_SYSTEM_PROMPT } from "./prompts.ts";
import { buildChunks, type SourceKind } from "../_shared/chunking.ts";
import { complete, modelLabel, parseJsonResponse } from "../_shared/extraction-model.ts";
import { reviewKrav, reviewerLabel } from "../_shared/review.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(level: string, message: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...ctx }));
}

interface ExtractedKrav {
  titel: string;
  beskrivning?: string;
  paragraf?: string;
  subjekt?: string[];
  trigger?: string[];
  undantag?: string[];
  obligation?: string;
  åtgärder?: unknown[];
  risknivå?: string;
}

const RISK = new Set(["hög", "medel", "låg"]);

function normalizeRisk(v?: string): string | null {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  return RISK.has(s) ? s : null;
}

function dedupeKey(k: ExtractedKrav): string {
  return `${(k.paragraf ?? "").toLowerCase().trim()}|${k.titel.toLowerCase().trim()}`;
}

// Granska ett insatt krav mot källtexten, lagra domslut och flytta till in_review.
async function reviewAndAdvance(
  supabase: SupabaseClient,
  row: Record<string, any>,
  sourceText: string,
) {
  try {
    const verdict = await reviewKrav(
      {
        titel: row.titel,
        beskrivning: row.beskrivning,
        lagrum: row.lagrum,
        subjekt: row.subjekt,
        risknivå: row.risknivå,
        obligation: row.obligation,
      },
      sourceText,
    );

    await supabase.from("model_verdict").insert({
      requirement_id: row.id,
      role: "reviewer",
      provider: verdict.provider,
      model: verdict.model,
      agrees: verdict.agrees,
      confidence: verdict.confidence,
      issues: verdict.issues,
      suggested_lagrum: verdict.suggestedLagrum,
      raw: verdict.raw,
    });

    const flags = [...verdict.issues];
    if (!verdict.agrees) flags.unshift("granskare_avviker");

    await supabase.from("requirement").update({
      status: "in_review",
      reviewer_confidence: verdict.confidence,
      reviewer_flags: flags,
    }).eq("id", row.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    // Granskning misslyckades — flagga och köa ändå, sorteras först (null-konfidens).
    await supabase.from("requirement").update({
      status: "in_review",
      reviewer_confidence: null,
      reviewer_flags: ["granskning_misslyckades: " + msg],
    }).eq("id", row.id);
  }
}

async function processJob(
  supabase: SupabaseClient,
  jobId: string,
  source: Record<string, any>,
) {
  const ctx = { jobId, sourceId: source.id };
  try {
    await supabase.from("extraction_job").update({ status: "processing" }).eq("id", jobId);

    const fullText: string = source.full_text || "";
    const kind = (source.typ || "lag") as SourceKind;
    const regelverk = source.regelverk_name || source.lagrum || "Okänt regelverk";

    const chunks = buildChunks(fullText, regelverk, kind);
    log("info", "Chunked document", { ...ctx, chunks: chunks.length, chars: fullText.length });

    if (chunks.length === 0) {
      await supabase.from("extraction_job")
        .update({ status: "completed", total_chunks: 0, requirements_found: 0 })
        .eq("id", jobId);
      return;
    }

    await supabase.from("extraction_chunk").insert(
      chunks.map((c) => ({
        job_id: jobId,
        chunk_index: c.index,
        lagrum_ref: c.lagrumRef,
        char_start: c.charStart,
        char_end: c.charEnd,
        status: "pending",
      })),
    );
    await supabase.from("extraction_job").update({ total_chunks: chunks.length }).eq("id", jobId);

    const seen = new Set<string>();
    let totalInserted = 0;
    let processed = 0;

    for (const c of chunks) {
      await supabase.from("extraction_chunk")
        .update({ status: "processing" })
        .eq("job_id", jobId).eq("chunk_index", c.index);

      try {
        const userPrompt =
          `Regelverk: ${regelverk}\nTyp: ${source.typ || ""}\nReferens: ${source.referens || ""}\n` +
          `Lagrum (chunk): ${c.lagrumRef}\n\nText:\n${c.text}`;

        const result = await complete({
          role: "extractor",
          system: LAW_SYSTEM_PROMPT,
          user: userPrompt,
          maxTokens: 12000,
        });

        const parsed = parseJsonResponse<{ krav?: ExtractedKrav[] }>(result.text);
        const krav = parsed.krav ?? [];

        const fresh = krav.filter((k) => {
          if (!k.titel) return false;
          const key = dedupeKey(k);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (fresh.length > 0) {
          const rows = fresh.map((k) => ({
            legal_source_id: source.id,
            workspace_id: source.workspace_id ?? null,
            titel: k.titel,
            beskrivning: k.beskrivning ?? null,
            lagrum: k.paragraf ?? c.lagrumRef,
            obligation: k.obligation ?? null,
            risknivå: normalizeRisk(k.risknivå),
            subjekt: k.subjekt ?? [],
            trigger: k.trigger ?? [],
            undantag: k.undantag ?? [],
            åtgärder: k.åtgärder ?? [],
            status: "draft",
            created_by: "ai",
          }));
          const { data: inserted, error } = await supabase
            .from("requirement").insert(rows).select();
          if (error) throw new Error(`Insert: ${error.message}`);
          totalInserted += rows.length;

          // Oberoende granskning av varje krav, sekventiellt.
          for (const row of inserted ?? []) {
            await reviewAndAdvance(supabase, row, c.text);
          }
        }

        await supabase.from("extraction_chunk")
          .update({ status: "completed", requirements_found: fresh.length })
          .eq("job_id", jobId).eq("chunk_index", c.index);
      } catch (chunkErr) {
        const msg = chunkErr instanceof Error ? chunkErr.message : "Okänt fel";
        log("error", "Chunk failed", { ...ctx, chunk: c.index, error: msg });
        await supabase.from("extraction_chunk")
          .update({ status: "failed", error: msg })
          .eq("job_id", jobId).eq("chunk_index", c.index);
      }

      processed++;
      await supabase.from("extraction_job")
        .update({ processed_chunks: processed, requirements_found: totalInserted })
        .eq("id", jobId);
    }

    const { count: failed } = await supabase
      .from("extraction_chunk")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId).eq("status", "failed");

    await supabase.from("extraction_job")
      .update({
        status: (failed ?? 0) > 0 && totalInserted === 0 ? "failed" : "completed",
        requirements_found: totalInserted,
      })
      .eq("id", jobId);

    log("info", "Job complete", { ...ctx, inserted: totalInserted, failedChunks: failed ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    log("error", "Job failed", { ...ctx, error: msg });
    await supabase.from("extraction_job").update({ status: "failed", error: msg }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { legal_source_id, workspace_id } = await req.json();
    if (!legal_source_id) {
      return json({ errorCode: "VALIDATION_ERROR", message: "legal_source_id krävs" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: source, error: fetchError } = await supabase
      .from("legal_source").select("*").eq("id", legal_source_id).single();

    if (fetchError || !source) {
      return json({ errorCode: "NOT_FOUND", message: "Källa hittades inte" }, 404);
    }

    const { data: job, error: jobError } = await supabase
      .from("extraction_job")
      .insert({
        legal_source_id,
        workspace_id: workspace_id ?? source.workspace_id ?? null,
        status: "pending",
        model: `${modelLabel("extractor")} + ${reviewerLabel()}`,
      })
      .select("id").single();

    if (jobError || !job) {
      return json({ errorCode: "SERVER_ERROR", message: "Kunde inte skapa jobb" }, 500);
    }

    // @ts-ignore EdgeRuntime finns i Supabase-runtimen
    EdgeRuntime.waitUntil(processJob(supabase, job.id, source));

    return json({ success: true, job_id: job.id, status: "pending" }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oväntat fel";
    log("error", "Unhandled", { error: msg });
    return json({ errorCode: "SERVER_ERROR", message: msg }, 500);
  }
});
