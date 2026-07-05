// =============================================================================
// DOMAIN MAPPERS
// =============================================================================
// Mappar mellan databasrader (Supabase) och domäntyper. Det kanoniska schemat
// (legal-requirements) saknar egna title/content-kolumner — visningstitel och
// brödtext härleds från regelverk_name/lagrum respektive full_text.
// =============================================================================

import { Tables } from "@/integrations/supabase/types";
import {
  LegalSource,
  LegalSourceType,
  MachineReviewStatus,
  Requirement,
  RequirementStatus,
  RiskLevel,
  LegalSourceSummary,
  SourceReference,
  LegalMatch,
} from "@/types/domain";

type LegalSourceRow = Tables<"legal_source">;
type RequirementRow = Tables<"requirement">;

// -----------------------------------------------------------------------------
// Legal Source Mappers
// -----------------------------------------------------------------------------

/** Visningstitel: regelverk + ev. lagrum. */
function deriveTitle(row: { regelverk_name: string; lagrum: string | null }): string {
  if (row.lagrum && row.lagrum !== row.regelverk_name) {
    return `${row.regelverk_name} ${row.lagrum}`.trim();
  }
  return row.regelverk_name;
}

export function mapSourceRowToLegalSource(row: LegalSourceRow): LegalSource {
  return {
    id: row.id,
    title: deriveTitle(row),
    content: row.full_text ?? "",
    fullText: row.full_text ?? undefined,
    regelverkName: row.regelverk_name ?? undefined,
    lagrum: row.lagrum ?? undefined,
    typ: (row.typ as LegalSourceType) ?? "annat",
    referens: row.referens ?? undefined,
    hasEmbedding: !!row.embedding,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: undefined,
  };
}

export function mapSourceRowsToLegalSources(rows: LegalSourceRow[]): LegalSource[] {
  return rows.map(mapSourceRowToLegalSource);
}

export function toLegalSourceSummary(source: LegalSource): LegalSourceSummary {
  return {
    id: source.id,
    title: source.title,
    regelverkName: source.regelverkName,
    lagrum: source.lagrum,
  };
}

// -----------------------------------------------------------------------------
// Requirement Mappers
// -----------------------------------------------------------------------------

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function parseRiskLevel(value: string | null): RiskLevel {
  const valid: RiskLevel[] = ["låg", "medel", "hög", "kritisk"];
  if (value && valid.includes(value as RiskLevel)) return value as RiskLevel;
  return "medel";
}

function parseStatus(value: string): RequirementStatus {
  const valid: RequirementStatus[] = ["draft", "in_review", "approved", "rejected", "archived"];
  return valid.includes(value as RequirementStatus) ? (value as RequirementStatus) : "draft";
}

function parseMachineStatus(value: unknown): MachineReviewStatus | undefined {
  const valid: MachineReviewStatus[] = ["pending", "processing", "green", "yellow", "red"];
  return valid.includes(value as MachineReviewStatus) ? (value as MachineReviewStatus) : undefined;
}

export function mapRequirementRowToRequirement(
  row: RequirementRow,
  legalSource?: { regelverk_name: string | null; lagrum: string | null }
): Requirement {
  return {
    id: row.id,
    legalSourceId: row.legal_source_id,
    titel: row.titel,
    beskrivning: row.beskrivning ?? undefined,
    lagrum: row.lagrum ?? undefined,
    obligation: row.obligation ?? undefined,
    subjekt: parseStringArray(row.subjekt),
    triggers: parseStringArray(row.trigger),
    åtgärder: parseStringArray(row.åtgärder),
    undantag: parseStringArray(row.undantag),
    risknivå: parseRiskLevel(row.risknivå),
    status: parseStatus(row.status),
    reviewerConfidence: row.reviewer_confidence ?? undefined,
    reviewerFlags: parseStringArray(row.reviewer_flags),
    sourceQuote: row.source_quote ?? undefined,
    // Kolumnerna nedan är nyare än den genererade typfilen — läses defensivt.
    machineReviewStatus: parseMachineStatus((row as Record<string, unknown>).machine_review_status),
    provisionId: typeof (row as Record<string, unknown>).provision_id === "number"
      ? ((row as Record<string, unknown>).provision_id as number)
      : undefined,
    chunkId: typeof (row as Record<string, unknown>).chunk_id === "string"
      ? ((row as Record<string, unknown>).chunk_id as string)
      : undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    createdBy: row.created_by ?? undefined,
    legalSource: legalSource
      ? {
          id: row.legal_source_id,
          title: legalSource.regelverk_name ?? "Okänd källa",
          regelverkName: legalSource.regelverk_name ?? undefined,
          lagrum: legalSource.lagrum ?? undefined,
        }
      : undefined,
  };
}

export function mapRequirementRowsToRequirements(
  rows: Array<RequirementRow & { legal_source?: { regelverk_name: string | null; lagrum: string | null } }>
): Requirement[] {
  return rows.map((row) => mapRequirementRowToRequirement(row, row.legal_source));
}

// -----------------------------------------------------------------------------
// Match/Reference Mappers
// -----------------------------------------------------------------------------

export function mapLegalMatchToSourceReference(match: LegalMatch): SourceReference {
  return {
    sourceId: match.id,
    title: match.regelverk_name ?? match.lagrum,
    lagrum: match.lagrum || undefined,
    regelverkName: match.regelverk_name,
    similarity: match.similarity,
  };
}

export function mapLegalMatchesToSourceReferences(matches: LegalMatch[]): SourceReference[] {
  return matches.map(mapLegalMatchToSourceReference);
}

// -----------------------------------------------------------------------------
// Input Mappers (Domain → Database)
// -----------------------------------------------------------------------------

export function mapCreateSourceInputToRow(input: {
  regelverkName: string;
  fullText: string;
  lagrum?: string;
  typ?: LegalSourceType;
  referens?: string;
}) {
  return {
    regelverk_name: input.regelverkName,
    full_text: input.fullText,
    lagrum: input.lagrum ?? input.regelverkName,
    typ: input.typ ?? "annat",
    referens: input.referens ?? null,
  };
}

export function mapUpdateRequirementInputToRow(input: {
  titel?: string;
  beskrivning?: string;
  lagrum?: string;
  obligation?: string;
  risknivå?: RiskLevel;
  subjekt?: string[];
  triggers?: string[];
  undantag?: string[];
  åtgärder?: string[];
}) {
  const row: Record<string, unknown> = {};
  if (input.titel !== undefined) row.titel = input.titel;
  if (input.beskrivning !== undefined) row.beskrivning = input.beskrivning;
  if (input.lagrum !== undefined) row.lagrum = input.lagrum;
  if (input.obligation !== undefined) row.obligation = input.obligation;
  if (input.risknivå !== undefined) row.risknivå = input.risknivå;
  if (input.subjekt !== undefined) row.subjekt = input.subjekt;
  if (input.triggers !== undefined) row.trigger = input.triggers;
  if (input.undantag !== undefined) row.undantag = input.undantag;
  if (input.åtgärder !== undefined) row.åtgärder = input.åtgärder;
  return row;
}
