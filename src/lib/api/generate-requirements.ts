import { supabase } from "@/integrations/supabase/client";

export interface ExtractionJobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_chunks: number;
  processed_chunks: number;
  requirements_found: number;
  error: string | null;
}

export interface StartExtractionResult {
  jobId: string;
  status: string;
}

/**
 * Startar asynkron kravextraktion. Returnerar ett jobb-id direkt;
 * dokumentet chunkas och bearbetas i bakgrunden. Använd pollExtractionJob
 * eller waitForExtractionJob för att följa förloppet.
 */
export async function startRequirementExtraction(
  sourceId: number,
  workspaceId?: string | null,
): Promise<StartExtractionResult> {
  const { data, error } = await supabase.functions.invoke("generate-requirements", {
    body: { legal_source_id: sourceId, workspace_id: workspaceId },
  });

  if (error) throw new Error(error.message || "Kunde inte starta kravextraktion");
  if (!data?.job_id) throw new Error("Inget jobb-id returnerades");

  return { jobId: data.job_id, status: data.status ?? "pending" };
}

export async function pollExtractionJob(jobId: string): Promise<ExtractionJobStatus> {
  const { data, error } = await supabase
    .from("extraction_job")
    .select("id, status, total_chunks, processed_chunks, requirements_found, error")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(error.message || "Kunde inte hämta jobbstatus");
  return data as ExtractionJobStatus;
}

/**
 * Pollar tills jobbet är klart eller misslyckats. onProgress anropas vid
 * varje statusuppdatering så UI:t kan visa "chunk X av Y".
 */
export async function waitForExtractionJob(
  jobId: string,
  onProgress?: (s: ExtractionJobStatus) => void,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ExtractionJobStatus> {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 15 * 60 * 1000;
  const start = Date.now();

  while (true) {
    const status = await pollExtractionJob(jobId);
    onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") return status;
    if (Date.now() - start > timeout) {
      throw new Error("Tidsgräns nådd för kravextraktion");
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * Bakåtkompatibel wrapper med samma signatur som tidigare synkrona API:t.
 * Startar jobbet och väntar in det, returnerar antal skapade krav.
 * onProgress låter anroparen visa förlopp ("chunk X av Y").
 */
export async function generateRequirementsForSource(
  sourceId: number,
  workspaceId?: string | null,
  onProgress?: (s: ExtractionJobStatus) => void,
): Promise<{ inserted: number; jobId: string }> {
  const { jobId } = await startRequirementExtraction(sourceId, workspaceId);
  const final = await waitForExtractionJob(jobId, onProgress);
  if (final.status === "failed") {
    throw new Error(final.error || "Kravextraktion misslyckades");
  }
  return { inserted: final.requirements_found, jobId };
}
