// =============================================================================
// DOMAIN TYPES for Legal Source Genie
// =============================================================================
// Central domain types that represent the business logic layer.
// These are decoupled from database schemas and API responses.
// =============================================================================

// -----------------------------------------------------------------------------
// Enums & Constants
// -----------------------------------------------------------------------------

export type LegalSourceType = 
  | "lag"           // Swedish law
  | "förordning"    // Regulation
  | "föreskrift"    // Directive/rule
  | "eu-förordning" // EU regulation
  | "dom"           // Court decision
  | "förarbete"     // Legislative history
  | "doktrin"       // Legal doctrine
  | "annat";        // Other

export type RiskLevel = "låg" | "medel" | "hög" | "kritisk";

export type RequirementStatus = "active" | "draft" | "archived";

// -----------------------------------------------------------------------------
// Core Domain Types
// -----------------------------------------------------------------------------

/**
 * Legal Source - A piece of legal text (law, regulation, court decision, etc.)
 */
export interface LegalSource {
  id: string;
  title: string;
  content: string;
  fullText?: string;
  regelverkName?: string;
  lagrum?: string;
  typ: LegalSourceType;
  referens?: string;
  hasEmbedding: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Requirement - A compliance requirement derived from a legal source
 */
export interface Requirement {
  id: string;
  legalSourceId: string;
  
  // Swedish fields (primary)
  titel: string;
  beskrivning?: string;
  
  // Structured fields
  obligation?: string;
  subjekt: string[];
  triggers: string[];
  åtgärder: string[];
  undantag: string[];
  risknivå: RiskLevel;
  
  // Metadata
  createdAt: Date;
  createdBy?: string;
  
  // Joined data (optional)
  legalSource?: LegalSourceSummary;
}

/**
 * Lightweight summary of a legal source (for joins)
 */
export interface LegalSourceSummary {
  id: string;
  title: string;
  regelverkName?: string;
  lagrum?: string;
}

/**
 * Matter - A client matter/case that groups related compliance work
 */
export interface Matter {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  workspaceId?: string;
  status: "active" | "closed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workspace - A workspace/organization container
 */
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

/**
 * Chat message with references to sources and requirements
 */
export interface ChatMessage {
  id: string;
  matterId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  
  // References found in the message
  sourceReferences: SourceReference[];
  requirementReferences: string[];
  
  createdAt: Date;
}

/**
 * Reference to a source with similarity score
 */
export interface SourceReference {
  sourceId: string;
  title: string;
  lagrum?: string;
  regelverkName?: string;
  similarity: number;
}

// -----------------------------------------------------------------------------
// Edge Function Response Types
// -----------------------------------------------------------------------------

export interface GeneratedRequirement {
  title: string;
  description?: string;
  titel?: string;
  beskrivning?: string;
  obligation?: string;
  subjekt?: string[];
  trigger?: string[];
  åtgärder?: string[];
  undantag?: string[];
  risknivå?: string;
}

export interface GenerateRequirementsResult {
  inserted: number;
  requirements?: GeneratedRequirement[];
}

export interface GenerateEmbeddingsResult {
  updated: number;
  total: number;
}

export interface LegalMatch {
  id: string;
  title: string;
  lagrum: string;
  similarity: number;
  regelverk_name?: string;
}

export interface AskQuestionResult {
  answer: string;
  matches: SourceReference[];
}

export interface ParsePdfResult {
  inserted: number;
  pages: number;
  processedPages: number;
}

export interface ParsePdfInput {
  file: File;
  regelverkName: string;
  typ: string;
  referens?: string;
}

// -----------------------------------------------------------------------------
// Riksdagen API Types
// -----------------------------------------------------------------------------

export interface RiksdagenDocument {
  dok_id: string;
  titel: string;
  undertitel?: string;
  notisrubrik?: string;
  publicerad: string;
  doktyp: string;
  rm: string;
  beteckning: string;
  dokument_url_html?: string;
  dokument_url_text?: string;
}

// -----------------------------------------------------------------------------
// Input Types for mutations
// -----------------------------------------------------------------------------

export interface CreateLegalSourceInput {
  title: string;
  content: string;
  fullText?: string;
  regelverkName?: string;
  lagrum?: string;
  typ?: LegalSourceType;
  referens?: string;
}

export interface UpdateRequirementInput {
  titel?: string;
  beskrivning?: string;
  obligation?: string;
  risknivå?: RiskLevel;
  subjekt?: string[];
  triggers?: string[];
  undantag?: string[];
  åtgärder?: string[];
}
