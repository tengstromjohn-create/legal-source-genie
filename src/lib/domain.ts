// =============================================================================
// DOMAIN MAPPERS
// =============================================================================
// Functions to map between database rows (Supabase) and domain types.
// This layer provides a clean separation between persistence and business logic.
// =============================================================================

import { Tables } from "@/integrations/supabase/types";
import {
  LegalSource,
  LegalSourceType,
  Requirement,
  RiskLevel,
  LegalSourceSummary,
  SourceReference,
  LegalMatch,
} from "@/types/domain";

// -----------------------------------------------------------------------------
// Type aliases for database rows
// -----------------------------------------------------------------------------

type LegalSourceRow = Tables<"legal_source">;
type RequirementRow = Tables<"requirement">;

// -----------------------------------------------------------------------------
// Legal Source Mappers
// -----------------------------------------------------------------------------

/**
 * Map a database row to a LegalSource domain object
 */
export function mapSourceRowToLegalSource(row: LegalSourceRow): LegalSource {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    fullText: row.full_text ?? undefined,
    regelverkName: row.regelverk_name ?? undefined,
    lagrum: row.lagrum ?? undefined,
    typ: (row.typ as LegalSourceType) ?? "annat",
    referens: row.referens ?? undefined,
    hasEmbedding: !!row.embedding,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map multiple database rows to LegalSource domain objects
 */
export function mapSourceRowsToLegalSources(rows: LegalSourceRow[]): LegalSource[] {
  return rows.map(mapSourceRowToLegalSource);
}

/**
 * Map a LegalSource to a summary (for joins)
 */
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

/**
 * Parse JSON array safely
 */
function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/**
 * Parse risk level safely
 */
function parseRiskLevel(value: string | null): RiskLevel {
  const validLevels: RiskLevel[] = ["låg", "medel", "hög", "kritisk"];
  if (value && validLevels.includes(value as RiskLevel)) {
    return value as RiskLevel;
  }
  return "medel";
}

/**
 * Map a database row to a Requirement domain object
 */
export function mapRequirementRowToRequirement(
  row: RequirementRow,
  legalSource?: { title: string; regelverk_name: string | null; lagrum: string | null }
): Requirement {
  return {
    id: row.id,
    legalSourceId: row.legal_source_id,
    titel: row.titel ?? row.title,
    beskrivning: row.beskrivning ?? row.description ?? undefined,
    obligation: row.obligation ?? undefined,
    subjekt: parseJsonArray(row.subjekt),
    triggers: parseJsonArray(row.trigger),
    åtgärder: parseJsonArray(row.åtgärder),
    undantag: parseJsonArray(row.undantag),
    risknivå: parseRiskLevel(row.risknivå),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by ?? undefined,
    legalSource: legalSource
      ? {
          id: row.legal_source_id,
          title: legalSource.title,
          regelverkName: legalSource.regelverk_name ?? undefined,
          lagrum: legalSource.lagrum ?? undefined,
        }
      : undefined,
  };
}

/**
 * Map multiple database rows to Requirement domain objects
 */
export function mapRequirementRowsToRequirements(
  rows: Array<RequirementRow & { legal_source?: { title: string; regelverk_name: string | null; lagrum: string | null } }>
): Requirement[] {
  return rows.map((row) => mapRequirementRowToRequirement(row, row.legal_source));
}

// -----------------------------------------------------------------------------
// Match/Reference Mappers
// -----------------------------------------------------------------------------

/**
 * Map a LegalMatch (from edge function) to SourceReference
 */
export function mapLegalMatchToSourceReference(match: LegalMatch): SourceReference {
  return {
    sourceId: match.id,
    title: match.title,
    lagrum: match.lagrum || undefined,
    regelverkName: match.regelverk_name,
    similarity: match.similarity,
  };
}

/**
 * Map multiple LegalMatches to SourceReferences
 */
export function mapLegalMatchesToSourceReferences(matches: LegalMatch[]): SourceReference[] {
  return matches.map(mapLegalMatchToSourceReference);
}

// -----------------------------------------------------------------------------
// Input Mappers (Domain → Database)
// -----------------------------------------------------------------------------

/**
 * Map CreateLegalSourceInput to database insert format
 */
export function mapCreateSourceInputToRow(input: {
  title: string;
  content: string;
  fullText?: string;
  regelverkName?: string;
  lagrum?: string;
  typ?: LegalSourceType;
  referens?: string;
}) {
  return {
    title: input.title,
    content: input.content,
    full_text: input.fullText ?? input.content,
    regelverk_name: input.regelverkName ?? null,
    lagrum: input.lagrum ?? null,
    typ: input.typ ?? null,
    referens: input.referens ?? null,
  };
}

/**
 * Map UpdateRequirementInput to database update format
 */
export function mapUpdateRequirementInputToRow(input: {
  titel?: string;
  beskrivning?: string;
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
  if (input.obligation !== undefined) row.obligation = input.obligation;
  if (input.risknivå !== undefined) row.risknivå = input.risknivå;
  if (input.subjekt !== undefined) row.subjekt = input.subjekt;
  if (input.triggers !== undefined) row.trigger = input.triggers;
  if (input.undantag !== undefined) row.undantag = input.undantag;
  if (input.åtgärder !== undefined) row.åtgärder = input.åtgärder;
  
  return row;
}
