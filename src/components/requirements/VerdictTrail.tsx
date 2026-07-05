// =============================================================================
// VerdictTrail — trestegs drill-down i juristvyn (block 5, steg 5).
//
// Nivå 1 (default): kompakt bedömningsrad — sammanvägd maskinstatus + en badge
// per modellinsats (Granskare A, Granskare B, ev. Arbiter) med instämmer/
// avviker och konfidens. Juristen ser på en sekund om maskinerna var eniga.
// Nivå 2 (ett klick): bedömningsspåret — varje insats fullständigt: modell,
// promptversion, konfidens, påpekanden, föreslagen paragraf, arbiterns
// motivering, samt de deterministiska kontrollflaggorna.
// Nivå 3 (ett klick per insats): råmaterialet — modellens fullständiga råsvar,
// latens och vilken kanonisk paragraf (provision) bedömningen gjordes mot.
//
// Kanonisk paragraftext visas i eget utfällbart block så juristen kan läsa
// krav, källcitat och lagtext sida vid sida utan att lämna dialogen.
// =============================================================================

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getVerdicts, type ModelVerdict } from "@/lib/api/review-queue";
import type { MachineReviewStatus } from "@/types/domain";

export const MACHINE_STATUS_META: Record<
  MachineReviewStatus,
  { label: string; cls: string }
> = {
  pending: { label: "AI-granskning väntar", cls: "bg-muted text-muted-foreground" },
  processing: { label: "AI granskar…", cls: "bg-blue-100 text-blue-800" },
  green: { label: "AI: grön", cls: "bg-green-100 text-green-800" },
  yellow: { label: "AI: gul (arbiter)", cls: "bg-amber-100 text-amber-900" },
  red: { label: "AI: röd", cls: "bg-red-100 text-red-800" },
};

const ROLE_LABELS: Record<string, string> = {
  extractor: "Extraktor",
  reviewer: "Granskare A",
  reviewer_b: "Granskare B",
  arbiter: "Arbiter",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function verdictBadge(v: ModelVerdict): { text: string; cls: string } {
  if (v.agrees === null) {
    return { text: `${roleLabel(v.role)}: anropsfel`, cls: "bg-muted text-muted-foreground" };
  }
  const conf = v.confidence !== null ? ` ${Number(v.confidence).toFixed(2)}` : "";
  return v.agrees
    ? { text: `${roleLabel(v.role)}: instämmer${conf}`, cls: "bg-green-100 text-green-800" }
    : { text: `${roleLabel(v.role)}: avviker${conf}`, cls: "bg-red-100 text-red-800" };
}

interface Provision {
  label: string;
  text: string;
}

interface VerdictTrailProps {
  requirementId: number;
  provisionId?: number;
  chunkId?: string;
  machineReviewStatus?: MachineReviewStatus;
  deterministicFlags: string[];
}

export const VerdictTrail = ({
  requirementId,
  provisionId,
  chunkId,
  machineReviewStatus,
  deterministicFlags,
}: VerdictTrailProps) => {
  const [verdicts, setVerdicts] = useState<ModelVerdict[] | null>(null);
  const [provision, setProvision] = useState<Provision | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrail, setShowTrail] = useState(false);
  const [showProvision, setShowProvision] = useState(false);
  const [rawOpen, setRawOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVerdicts(null);
    setProvision(null);
    (async () => {
      try {
        const [v, p] = await Promise.all([
          getVerdicts(requirementId),
          provisionId
            ? supabase
                .from("source_provision")
                .select("label, text")
                .eq("id", provisionId)
                .maybeSingle()
                .then(({ data }) => data as Provision | null)
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          // Äldst först: extraktion → granskare → arbiter läses som en tidslinje.
          setVerdicts([...v].reverse());
          setProvision(p);
        }
      } catch {
        if (!cancelled) setVerdicts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requirementId, provisionId]);

  const machineMeta = machineReviewStatus ? MACHINE_STATUS_META[machineReviewStatus] : null;

  return (
    <div className="space-y-2">
      {/* Nivå 1 — kompakt bedömningsrad */}
      <div className="flex items-center gap-2 flex-wrap">
        {machineMeta && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${machineMeta.cls}`}>
            {machineMeta.label}
          </span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {!loading &&
          (verdicts ?? []).map((v) => {
            const b = verdictBadge(v);
            return (
              <span key={v.id} className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.cls}`}>
                {b.text}
              </span>
            );
          })}
        {!loading && (verdicts ?? []).length === 0 && (
          <span className="text-xs text-muted-foreground">Inga modellbedömningar ännu</span>
        )}
      </div>

      {/* Kanonisk paragraftext sida vid sida med kravet */}
      {provision && (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
            onClick={() => setShowProvision((s) => !s)}
          >
            {showProvision ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Kanonisk paragraftext ({provision.label})
          </button>
          {showProvision && (
            <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-xs font-sans">
              {provision.text}
            </pre>
          )}
        </div>
      )}

      {/* Nivå 2 — bedömningsspåret */}
      {!loading && (verdicts ?? []).length > 0 && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowTrail((s) => !s)}
          >
            {showTrail ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}
            Bedömningsspår ({(verdicts ?? []).length} insatser)
          </Button>

          {showTrail && (
            <div className="mt-1 space-y-2">
              <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Extraktion:</span>{" "}
                chunk {chunkId ? chunkId.slice(0, 8) : "–"}, provision-id {provisionId ?? "–"}.{" "}
                <span className="font-semibold text-foreground">Deterministiska flaggor:</span>{" "}
                {deterministicFlags.length > 0 ? deterministicFlags.join(", ") : "inga"}
              </div>

              {(verdicts ?? []).map((v) => {
                const motivation =
                  v.raw && typeof v.raw === "object" && "motivation" in (v.raw as object)
                    ? String((v.raw as { motivation?: unknown }).motivation ?? "")
                    : "";
                return (
                  <div key={v.id} className="rounded-md border px-2 py-1.5 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{roleLabel(v.role)}</span>
                      <span className="text-muted-foreground">
                        {v.provider && v.model ? `${v.provider}:${v.model}` : "anrop misslyckades"}
                        {v.prompt_version ? ` · prompt ${v.prompt_version}` : ""}
                        {typeof v.latency_ms === "number" ? ` · ${(v.latency_ms / 1000).toFixed(1)} s` : ""}
                      </span>
                    </div>
                    <div>
                      {v.agrees === null ? (
                        <span className="text-muted-foreground">Bedömning saknas (anropsfel)</span>
                      ) : (
                        <>
                          <span className={v.agrees ? "text-green-700" : "text-red-700"}>
                            {v.agrees ? "Instämmer" : "Avviker"}
                          </span>
                          {v.confidence !== null && (
                            <span className="text-muted-foreground"> · konfidens {Number(v.confidence).toFixed(2)}</span>
                          )}
                        </>
                      )}
                    </div>
                    {motivation && (
                      <div>
                        <span className="font-semibold">Motivering:</span> {motivation}
                      </div>
                    )}
                    {v.issues && v.issues.length > 0 && (
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {v.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    {v.suggested_lagrum && (
                      <div>
                        <span className="font-semibold">Föreslagen paragraf:</span> {v.suggested_lagrum}
                      </div>
                    )}

                    {/* Nivå 3 — råmaterialet per insats */}
                    {v.raw_response && (
                      <div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                          onClick={() => setRawOpen((s) => ({ ...s, [v.id]: !s[v.id] }))}
                        >
                          {rawOpen[v.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Råmaterial
                        </button>
                        {rawOpen[v.id] && (
                          <div className="mt-1 space-y-1">
                            <div className="text-muted-foreground">
                              Bedömd mot provision-id {v.input_provision_id ?? "–"}
                            </div>
                            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
                              {v.raw_response}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
