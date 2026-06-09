import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { LAW_SYSTEM_PROMPT } from "../generate-requirements/prompts.ts";
import { complete, parseJsonResponse } from "../_shared/extraction-model.ts";

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

// Trigga nästa körning. Workern ackar direkt (202), så detta returnerar snabbt.
async function triggerNext(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-extraction-chunk`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch (e) {
    log("warn", "triggerNext failed", { jobId, error: String(e) });
  }
}

async function finalizeIfDone(supabase: SupabaseClient, jobId: string): Promise<boolean> {
  const { count: pending } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "pending");
  if ((pending ?? 0) > 0) return false;

  const { count: failed } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed");
  const { count: done } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "completed");

  await supabase.from("extraction_job").update({
    status: (failed ?? 0) > 0 && (done ?? 0) === 0 ? "failed" : "completed",
  }).eq("id", jobId);
  return true;
}

async function processChunk(supabase: SupabaseClient, job_id: string) {
  try {
    const { data: job } = await supabase.from("extraction_job").select("*").eq("id", job_id).single();
    if (!job) return;
    if (job.status === "completed" || job.status === "failed") return;

    await supabase.from("extraction_job").update({ status: "processing" }).eq("id", job_id);

    // Plocka nästa väntande chunk.
    const { data: chunk } = await supabase.from("extraction_chunk")
      .select("*").eq("job_id", job_id).eq("status", "pending")
      .order("chunk_index", { ascending: true }).limit(1).maybeSingle();

    if (!chunk) {
      await finalizeIfDone(supabase, job_id);
      return;
    }

    await supabase.from("extraction_chunk").update({ status: "processing" }).eq("id", chunk.id);

    const { data: source } = await supabase.from("legal_source").select("*").eq("id", job.legal_source_id).single();
    const regelverk = source?.regelverk_name || source?.lagrum || "Okänt regelverk";

    let insertedCount = 0;
    try {
      const userPrompt =
        `Regelverk: ${regelverk}\nTyp: ${source?.typ || ""}\nReferens: ${source?.referens || ""}\n` +
        `Lagrum (chunk): ${chunk.lagrum_ref}\n\nText:\n${chunk.chunk_text || ""}`;

      const result = await complete({ role: "extractor", system: LAW_SYSTEM_PROMPT, user: userPrompt, maxTokens: 12000 });
      const parsed = parseJsonResponse<{ krav?: ExtractedKrav[] }>(result.text);
      const krav = parsed.krav ?? [];

      // Dedupe mot redan insatta krav för källan (lagrum+titel).
      const { data: existing } = await supabase.from("requirement")
        .select("lagrum, titel").eq("legal_source_id", job.legal_source_id);
      const seen = new Set((existing ?? []).map((e: any) => `${(e.lagrum ?? "").toLowerCase().trim()}|${(e.titel ?? "").toLowerCase().trim()}`));

      const fresh = krav.filter((k) => {
        if (!k.titel) return false;
        const key = `${(k.paragraf ?? chunk.lagrum_ref ?? "").toLowerCase().trim()}|${k.titel.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (fresh.length > 0) {
        const rows = fresh.map((k) => ({
          legal_source_id: job.legal_source_id,
          workspace_id: job.workspace_id ?? source?.workspace_id ?? null,
          titel: k.titel, beskrivning: k.beskrivning ?? null,
          lagrum: k.paragraf ?? chunk.lagrum_ref,
          obligation: k.obligation ?? null, risknivå: normalizeRisk(k.risknivå),
          subjekt: k.subjekt ?? [], trigger: k.trigger ?? [], undantag: k.undantag ?? [],
          åtgärder: k.åtgärder ?? [], status: "draft", created_by: "ai",
        }));
        const { error } = await supabase.from("requirement").insert(rows);
        if (error) throw new Error(`Insert: ${error.message}`);
        insertedCount = rows.length;
      }

      await supabase.from("extraction_chunk").update({ status: "completed", requirements_found: insertedCount }).eq("id", chunk.id);
    } catch (chunkErr) {
      const msg = chunkErr instanceof Error ? chunkErr.message : "Okänt fel";
      log("error", "Chunk failed", { jobId: job_id, chunk: chunk.chunk_index, error: msg });
      await supabase.from("extraction_chunk").update({ status: "failed", error: msg }).eq("id", chunk.id);
    }

    // Uppdatera jobbprogress.
    const { count: processed } = await supabase.from("extraction_chunk")
      .select("*", { count: "exact", head: true }).eq("job_id", job_id).in("status", ["completed", "failed"]);
    const { data: agg } = await supabase.from("extraction_chunk")
      .select("requirements_found").eq("job_id", job_id).eq("status", "completed");
    const totalReqs = (agg ?? []).reduce((s: number, r: any) => s + (r.requirements_found ?? 0), 0);
    await supabase.from("extraction_job").update({
      processed_chunks: processed ?? 0, requirements_found: totalReqs,
    }).eq("id", job_id);

    // Klart eller trigga nästa chunk.
    const finalized = await finalizeIfDone(supabase, job_id);
    if (!finalized) await triggerNext(job_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oväntat fel";
    log("error", "processChunk failed", { jobId: job_id, error: msg });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { job_id } = await req.json();
    if (!job_id) return json({ errorCode: "VALIDATION_ERROR", message: "job_id krävs" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Kvittera direkt, bearbeta chunken i bakgrunden så anropskedjan inte hänger.
    // @ts-ignore EdgeRuntime finns i Supabase-runtimen
    EdgeRuntime.waitUntil(processChunk(supabase, job_id));
    return json({ accepted: true, job_id }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oväntat fel";
    log("error", "Unhandled", { error: msg });
    return json({ errorCode: "SERVER_ERROR", message: msg }, 500);
  }
});
