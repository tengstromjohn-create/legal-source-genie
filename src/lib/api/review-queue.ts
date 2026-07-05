import { supabase } from "@/integrations/supabase/client";

export interface ReviewQueueItem {
  id: number;
  legal_source_id: number;
  workspace_id: string | null;
  titel: string;
  beskrivning: string | null;
  lagrum: string | null;
  risknivå: string | null;
  obligation: string | null;
  subjekt: string[] | null;
  trigger: string[] | null;
  undantag: string[] | null;
  reviewer_confidence: number | null;
  reviewer_flags: string[] | null;
  created_at: string;
  regelverk_name: string | null;
  referens: string | null;
  source_full_text: string | null;
}

export interface ModelVerdict {
  id: string;
  requirement_id: number;
  role: string;
  provider: string | null;
  model: string | null;
  agrees: boolean | null;
  confidence: number | null;
  issues: string[] | null;
  suggested_lagrum: string | null;
  created_at: string;
  // Drill-down-spår (block 5): promptversion, fullt råsvar, latens och vilken
  // kanonisk paragraf bedömningen gjordes mot. raw bär arbiterns motivering.
  prompt_version: string | null;
  raw_response: string | null;
  latency_ms: number | null;
  input_provision_id: number | null;
  raw: unknown;
}

/**
 * Hämtar juristkön — krav som väntar på granskning, mest osäkra först
 * (lägst konfidens, null-konfidens överst då granskning saknas).
 */
export async function listReviewQueue(workspaceId?: string | null): Promise<ReviewQueueItem[]> {
  let query = supabase
    .from("review_queue")
    .select("*")
    .order("reviewer_confidence", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Kunde inte hämta granskningskön");
  return (data ?? []) as ReviewQueueItem[];
}

export async function getVerdicts(requirementId: number): Promise<ModelVerdict[]> {
  const { data, error } = await supabase
    .from("model_verdict")
    .select("*")
    .eq("requirement_id", requirementId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Kunde inte hämta domslut");
  return (data ?? []) as ModelVerdict[];
}

/** Logga juristbeslutet med fryst kontext — grunden för golden dataset. */
async function logDecision(
  id: number,
  decision: "approved" | "rejected" | "edited_approved",
  note?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { data: req } = await supabase
    .from("requirement")
    .select("reviewer_flags, source_quote, lagrum")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("review_decision").insert({
    requirement_id: id,
    decision,
    note: note ?? null,
    reviewer: userData?.user?.id ?? null,
    flags_at_decision: (req as any)?.reviewer_flags ?? null,
    source_quote_at_decision: (req as any)?.source_quote ?? null,
    lagrum_at_decision: (req as any)?.lagrum ?? null,
  });
}

/** Godkänn ett krav. Endast godkända krav exponeras mot externa konsumenter. */
export async function approveRequirement(id: number, note?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("requirement")
    .update({
      status: "approved",
      reviewed_by: userData?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message || "Kunde inte godkänna kravet");
  await logDecision(id, "approved", note);
}

/** Avslå ett krav (felaktigt/ogrundat). Sparas men exponeras aldrig. */
export async function rejectRequirement(id: number, note?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("requirement")
    .update({
      status: "rejected",
      reviewed_by: userData?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message || "Kunde inte avslå kravet");
  await logDecision(id, "rejected", note);
}

/** Redigera och godkänn i ett steg — juristens korrigering blir facit. */
export async function editAndApproveRequirement(
  id: number,
  patch: Partial<Pick<ReviewQueueItem, "titel" | "beskrivning" | "lagrum" | "risknivå" | "obligation">>,
  note?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("requirement")
    .update({
      ...patch,
      status: "approved",
      reviewed_by: userData?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message || "Kunde inte uppdatera kravet");
  await logDecision(id, "edited_approved", note);
}
