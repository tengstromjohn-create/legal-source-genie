import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildChunks, type SourceKind } from "../_shared/chunking.ts";
import { modelLabel } from "../_shared/extraction-model.ts";
import { reviewerLabel } from "../_shared/review.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHUNK_CHARS = 12000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(level: string, message: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...ctx }));
}

// Starta worker-funktionen som bearbetar chunkar en i taget.
async function triggerWorker(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-extraction-chunk`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch (e) {
    log("warn", "triggerWorker failed", { jobId, error: String(e) });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { legal_source_id, workspace_id } = await req.json();
    if (!legal_source_id) {
      return json({ errorCode: "VALIDATION_ERROR", message: "legal_source_id krävs" }, 400);
    }

    const supabase: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: source, error: fetchError } = await supabase
      .from("legal_source").select("*").eq("id", legal_source_id).single();
    if (fetchError || !source) {
      return json({ errorCode: "NOT_FOUND", message: "Källa hittades inte" }, 404);
    }

    const fullText: string = source.full_text || "";
    const kind = (source.typ || "lag") as SourceKind;
    const regelverk = source.regelverk_name || source.lagrum || "Okänt regelverk";
    const chunks = buildChunks(fullText, regelverk, kind, MAX_CHUNK_CHARS);

    const { data: job, error: jobError } = await supabase
      .from("extraction_job")
      .insert({
        legal_source_id,
        workspace_id: workspace_id ?? source.workspace_id ?? null,
        status: "pending",
        total_chunks: chunks.length,
        model: `${modelLabel("extractor")} + ${reviewerLabel()}`,
      })
      .select("id").single();
    if (jobError || !job) {
      return json({ errorCode: "SERVER_ERROR", message: "Kunde inte skapa jobb" }, 500);
    }

    if (chunks.length === 0) {
      await supabase.from("extraction_job")
        .update({ status: "completed", requirements_found: 0 }).eq("id", job.id);
      return json({ success: true, job_id: job.id, status: "completed", chunks: 0 }, 200);
    }

    // Registrera alla chunkar med text så workern kan bearbeta dem var för sig.
    await supabase.from("extraction_chunk").insert(
      chunks.map((c) => ({
        job_id: job.id,
        chunk_index: c.index,
        lagrum_ref: c.lagrumRef,
        char_start: c.charStart,
        char_end: c.charEnd,
        chunk_text: c.text,
        status: "pending",
      })),
    );

    log("info", "Job created", { jobId: job.id, sourceId: legal_source_id, chunks: chunks.length });

    // Starta bearbetningen — workern bearbetar en chunk och triggar nästa.
    await triggerWorker(job.id);

    return json({ success: true, job_id: job.id, status: "pending", chunks: chunks.length }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oväntat fel";
    log("error", "Unhandled", { error: msg });
    return json({ errorCode: "SERVER_ERROR", message: msg }, 500);
  }
});
