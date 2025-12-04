// Domain types for edge function responses

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
  matches: LegalMatch[];
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
