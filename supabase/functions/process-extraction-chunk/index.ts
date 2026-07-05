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
  källcitat?: string;
  subjekt?: string[];
  trigger?: string[];
  undantag?: string[];
  obligation?: string;
  åtgärder?: unknown[];
  risknivå?: string;
}

// Normalisera en paragrafhänvisning till indexets kanoniska form,
// t.ex. "ABL 8 kap 4§" → "8 kap. 4 §", "24 a kap. 5 §" → "24 a kap. 5 §".
// Returnerar null om strängen inte innehåller en svensk paragrafreferens.
function normalizeLagrum(raw: string): string | null {
  const m = raw.match(/(?:(\d{1,3})\s*(?:([a-z])\s*)?kap\.?\s*)?(\d{1,3})\s*(?:([a-z])\s*)?§/i);
  if (!m) return null;
  const [, kapNum, kapLetter, parNum, parLetter] = m;
  const kap = kapNum ? `${parseInt(kapNum, 10)}${kapLetter ? ` ${kapLetter.toLowerCase()}` : ""} kap. ` : "";
  return `${kap}${parseInt(parNum, 10)}${parLetter ? ` ${parLetter.toLowerCase()}` : ""} §`;
}

// Whitespace-tolerant jämförelse: källtexten är hårdradbruten, modellen
// återger citat med enkla mellanslag. Allt whitespace kollapsas före substräng-
// jämförelse; själva tecknen måste vara ordagranna.
function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
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

// När ett extraktionsjobb är klart triggas granskningskedjan (steg 3–4,
// block 5) för källans nya krav. Fire-and-forget: review-worker ackar
// direkt och driver sin egen kö.
async function triggerReviewWorker(legalSourceId: number) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/review-worker`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ legal_source_id: legalSourceId }),
    });
  } catch (e) {
    log("warn", "triggerReviewWorker failed", { legalSourceId, error: String(e) });
  }
}

async function finalizeIfDone(
  supabase: SupabaseClient,
  jobId: string,
  legalSourceId: number | null,
): Promise<boolean> {
  const { count: pending } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "pending");
  if ((pending ?? 0) > 0) return false;

  const { count: failed } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed");
  const { count: done } = await supabase.from("extraction_chunk")
    .select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "completed");

  const finalStatus = (failed ?? 0) > 0 && (done ?? 0) === 0 ? "failed" : "completed";
  await supabase.from("extraction_job").update({ status: finalStatus }).eq("id", jobId);

  if (finalStatus === "completed" && legalSourceId !== null) {
    await triggerReviewWorker(legalSourceId);
  }
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
      await finalizeIfDone(supabase, job_id, job.legal_source_id ?? null);
      return;
    }

    await supabase.from("extraction_chunk").update({ status: "processing" }).eq("id", chunk.id);

    const { data: source } = await supabase.from("legal_source").select("*").eq("id", job.legal_source_id).single();
    const regelverk = source?.regelverk_name || source?.lagrum || "Okänt regelverk";

    // Paragrafindexet är facit: kravens hänvisningar slås upp deterministiskt.
    const { data: provisionRows } = await supabase.from("source_provision")
      .select("id, label, text").eq("legal_source_id", job.legal_source_id);
    const provisionIndex = new Map<string, { id: number; label: string; squashed: string }>();
    const allProvisions: { id: number; label: string; squashed: string }[] = [];
    for (const pr of provisionRows ?? []) {
      const entry = { id: pr.id, label: pr.label, squashed: squash(pr.text ?? "") };
      allProvisions.push(entry);
      const norm = normalizeLagrum(pr.label);
      if (norm) provisionIndex.set(norm, entry);
    }

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
        const rows = fresh.map((k) => {
          // Deterministisk grundningskontroll (audit 2026-07-05, steg 2).
          // Kontroll A: paragrafen måste finnas i paragrafindexet.
          const norm = k.paragraf ? normalizeLagrum(k.paragraf) : null;
          let hit = norm ? provisionIndex.get(norm) : undefined;
          const flags: string[] = [];
          if (!hit) flags.push("paragraf_ej_i_index");

          // Kontroll B: källcitatet måste ordagrant finnas i den paragraf
          // kravet pekar på. Citatet är facit: finns det i en annan paragraf
          // omankras kravet dit (modellen angav fel adress till rätt text).
          const quote = (k.källcitat ?? "").trim();
          const squashedQuote = squash(quote);
          if (squashedQuote.length < 20) {
            flags.push("citat_saknas");
          } else if (hit && hit.squashed.includes(squashedQuote)) {
            // Verifierat: citat + paragraf hör ihop.
          } else {
            const matches = allProvisions.filter((p) => p.squashed.includes(squashedQuote));
            if (matches.length === 1) {
              hit = matches[0];
              flags.push("omankrad_via_citat");
            } else if (matches.length > 1) {
              flags.push("citat_i_flera_paragrafer");
            } else {
              flags.push("citat_ej_verifierat");
            }
          }

          return {
            legal_source_id: job.legal_source_id,
            workspace_id: job.workspace_id ?? source?.workspace_id ?? null,
            titel: k.titel, beskrivning: k.beskrivning ?? null,
            lagrum: hit ? hit.label : (k.paragraf ?? chunk.lagrum_ref),
            provision_id: hit ? hit.id : null,
            chunk_id: chunk.id,
            source_quote: quote || null,
            reviewer_flags: flags,
            obligation: k.obligation ?? null, risknivå: normalizeRisk(k.risknivå),
            subjekt: k.subjekt ?? [], trigger: k.trigger ?? [], undantag: k.undantag ?? [],
            åtgärder: k.åtgärder ?? [], status: "draft", created_by: "ai",
          };
        });
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
    const finalized = await finalizeIfDone(supabase, job_id, job.legal_source_id ?? null);
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
