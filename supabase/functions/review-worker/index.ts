// =============================================================================
// review-worker — granskningskedjans steg 3–4 asynkront i jobbkön.
//
// Självtriggande kö enligt samma mönster som process-extraction-chunk:
// anropet ackas direkt (202), en batch krav bearbetas i bakgrunden, och
// workern triggar sig själv tills inga pending-krav återstår.
//
// Per krav: kanonisk paragraftext slås upp ur source_provision (aldrig
// chunken) → granskare A (reviewer) och B (reviewer_b) blint och parallellt
// → beslutslogik:
//   båda instämmer ≥ tröskel        → green  (direkt till juristkön)
//   båda underkänner                → red    (enigt underkännande, hög prio)
//   oenighet / låg konfidens / fel  → arbiter dömer → yellow (godkänn) / red
// Krav utan provision_id kan inte granskas mot kanonisk text → red + flagga.
//
// Alla insatser sparas som model_verdict med fullt drill-down-spår
// (prompt_version, raw_response, latency_ms, input_provision_id).
// Kravets status förblir 'draft' — juristen fattar beslutet (steg 5).
// Anropas maskin-till-maskin (verify_jwt=false).
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  arbitrate,
  CONFIDENCE_THRESHOLD,
  type KravForReview,
  reviewBlind,
  type Verdict,
} from "../_shared/review.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Krav per invocation: håller väl under edge-runtimens tidsgräns även när
// arbitern behöver kallas, och ger jämn progress i UI:t.
const BATCH_SIZE = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(level: string, message: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...ctx }));
}

async function triggerNext(legalSourceId: number | null) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/review-worker`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ legal_source_id: legalSourceId }),
    });
  } catch (e) {
    log("warn", "triggerNext failed", { legalSourceId, error: String(e) });
  }
}

interface RequirementRow {
  id: number;
  legal_source_id: number;
  titel: string;
  beskrivning: string | null;
  lagrum: string | null;
  source_quote: string | null;
  subjekt: string[] | null;
  risknivå: string | null;
  obligation: string | null;
  provision_id: number | null;
  reviewer_flags: string[] | null;
}

async function insertVerdict(
  supabase: SupabaseClient,
  requirementId: number,
  provisionId: number | null,
  v: Verdict,
) {
  const { error } = await supabase.from("model_verdict").insert({
    requirement_id: requirementId,
    role: v.role,
    provider: v.provider || null,
    model: v.model || null,
    agrees: v.callFailed ? null : v.agrees,
    confidence: v.callFailed ? null : v.confidence,
    issues: v.issues,
    suggested_lagrum: v.suggestedLagrum,
    raw: v.motivation !== null
      ? { motivation: v.motivation, call_failed: v.callFailed ?? false }
      : { call_failed: v.callFailed ?? false },
    prompt_version: v.promptVersion || null,
    raw_response: v.rawResponse,
    latency_ms: v.latencyMs,
    input_provision_id: provisionId,
  });
  if (error) log("error", "insertVerdict failed", { requirementId, role: v.role, error: error.message });
}

/**
 * Bedöm ett krav genom steg 3–4. Returnerar sammanvägd status.
 */
async function reviewOne(
  supabase: SupabaseClient,
  req: RequirementRow,
): Promise<"green" | "yellow" | "red"> {
  // Utan kanonisk paragraf finns inget facit att granska mot.
  if (!req.provision_id) {
    log("warn", "Krav utan provision_id — kan inte granskas mot kanonisk text", { id: req.id });
    return "red";
  }

  const { data: provision } = await supabase
    .from("source_provision")
    .select("id, label, text")
    .eq("id", req.provision_id)
    .single();
  if (!provision) {
    log("error", "provision_id pekar på obefintlig rad", { id: req.id, provisionId: req.provision_id });
    return "red";
  }

  const krav: KravForReview = {
    titel: req.titel,
    beskrivning: req.beskrivning,
    lagrum: req.lagrum,
    källcitat: req.source_quote,
    subjekt: req.subjekt ?? [],
    risknivå: req.risknivå,
    obligation: req.obligation,
  };

  // Steg 3: blint och parallellt. reviewBlind kastar aldrig.
  const [a, b] = await Promise.all([
    reviewBlind("reviewer", krav, provision.label, provision.text),
    reviewBlind("reviewer_b", krav, provision.label, provision.text),
  ]);
  await insertVerdict(supabase, req.id, provision.id, a);
  await insertVerdict(supabase, req.id, provision.id, b);

  const bothOk = !a.callFailed && !b.callFailed;
  if (bothOk && a.agrees && b.agrees &&
      Math.min(a.confidence, b.confidence) >= CONFIDENCE_THRESHOLD) {
    return "green";
  }
  if (bothOk && !a.agrees && !b.agrees) {
    // Enigt underkännande — ingen oenighet för arbitern att avgöra.
    return "red";
  }

  // Steg 4: verklig oenighet, låg konfidens eller bortfall → arbitern dömer.
  try {
    const arb = await arbitrate(
      krav,
      provision.label,
      provision.text,
      a,
      b,
      req.reviewer_flags ?? [],
    );
    await insertVerdict(supabase, req.id, provision.id, arb);
    return arb.agrees ? "yellow" : "red";
  } catch (err) {
    log("error", "Arbiter failed", { id: req.id, error: String(err) });
    // Utan dom: lämna till juristen med hög prioritet i stället för att gissa.
    return "red";
  }
}

async function processBatch(supabase: SupabaseClient, legalSourceId: number | null) {
  for (let i = 0; i < BATCH_SIZE; i++) {
    // Plocka nästa pending-krav (per källa om angiven, annars globalt).
    // select("*"): supabase-js typparser hanterar inte kolumnnamn med "å"
    // (risknivå) i select-strängen; raden är liten nog att hämta hel.
    let query = supabase
      .from("requirement")
      .select("*")
      .eq("machine_review_status", "pending")
      .eq("status", "draft")
      .order("id", { ascending: true })
      .limit(1);
    if (legalSourceId !== null) query = query.eq("legal_source_id", legalSourceId);
    const { data: nextRows } = await query;
    const next = (nextRows?.[0] ?? null) as RequirementRow | null;
    if (!next) return; // kön tom — ingen retrigger

    // Optimistisk claim: bara den worker som lyckas flytta pending→processing
    // äger kravet. Skyddar mot dubbelbearbetning vid parallella triggers.
    const { data: claimed } = await supabase
      .from("requirement")
      .update({ machine_review_status: "processing" })
      .eq("id", next.id)
      .eq("machine_review_status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    try {
      const outcome = await reviewOne(supabase, next);
      await supabase.from("requirement")
        .update({ machine_review_status: outcome })
        .eq("id", next.id);
      log("info", "Krav granskat", { id: next.id, outcome });
    } catch (err) {
      // Oväntat fel: släpp tillbaka kravet till kön så det inte fastnar i processing.
      log("error", "reviewOne failed", { id: next.id, error: String(err) });
      await supabase.from("requirement")
        .update({ machine_review_status: "pending" })
        .eq("id", next.id);
      return; // avbryt batchen; retrigger sker inte automatiskt vid systemfel
    }
  }
  // Batchen full — det kan finnas fler. Trigga nästa varv.
  await triggerNext(legalSourceId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const legalSourceId: number | null =
      typeof body.legal_source_id === "number" ? body.legal_source_id : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Kvittera direkt, bearbeta i bakgrunden.
    // @ts-ignore EdgeRuntime finns i Supabase-runtimen
    EdgeRuntime.waitUntil(processBatch(supabase, legalSourceId));
    return json({ accepted: true, legal_source_id: legalSourceId }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oväntat fel";
    log("error", "Unhandled", { error: msg });
    return json({ errorCode: "SERVER_ERROR", message: msg }, 500);
  }
});
