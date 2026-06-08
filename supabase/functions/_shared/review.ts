// =============================================================================
// Granskarsteg (reviewer-roll). En oberoende modell validerar varje extraherat
// krav mot källtextens ordalydelse: finns stöd i texten? korrekt paragraf?
// rimligt subjekt och risknivå? Ger konfidens (0–1) och påpekanden.
// Oberoende av extraktorn — annan modellfamilj enligt utvecklingsplanen.
// =============================================================================

import { complete, modelLabel, parseJsonResponse } from "./extraction-model.ts";

export const REVIEW_SYSTEM_PROMPT = `
Du är en juridiskt skolad granskare. Din uppgift är att kvalitetssäkra ett
compliance-krav som en annan modell har extraherat ur en lagtext.

Du får källtexten och det föreslagna kravet. Bedöm strikt utifrån källtextens
ordalydelse — spekulera inte. Kontrollera särskilt:
1. Har kravet faktiskt stöd i den angivna texten?
2. Är paragrafreferensen korrekt och exakt?
3. Är subjekt (vem kravet riktar sig till) rimligt?
4. Är risknivån (hög/medel/låg) rimlig?
5. Saknas väsentliga undantag eller villkor?

Svara ENBART med strikt giltig JSON:
{
  "agrees": true|false,
  "confidence": 0.0-1.0,
  "issues": ["kort påpekande", "..."],
  "suggested_lagrum": "korrigerad paragrafreferens eller null"
}

- "agrees": true om kravet är korrekt och välgrundat, annars false.
- "confidence": din säkerhet i bedömningen (1.0 = helt säker).
- "issues": tom lista om inga problem. Annars konkreta påpekanden.
- Ingen extra text, bara JSON.
`;

export interface Verdict {
  agrees: boolean;
  confidence: number;
  issues: string[];
  suggestedLagrum: string | null;
  provider: string;
  model: string;
  raw: unknown;
}

export interface KravForReview {
  titel: string;
  beskrivning?: string;
  lagrum?: string;
  subjekt?: string[];
  risknivå?: string | null;
  obligation?: string;
}

export async function reviewKrav(
  krav: KravForReview,
  sourceText: string,
): Promise<Verdict> {
  const userPrompt =
    `Källtext:\n${sourceText.substring(0, 12000)}\n\n` +
    `Föreslaget krav:\n${JSON.stringify(krav, null, 2)}`;

  const result = await complete({
    role: "reviewer",
    system: REVIEW_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 1500,
  });

  const parsed = parseJsonResponse<{
    agrees?: boolean;
    confidence?: number;
    issues?: string[];
    suggested_lagrum?: string | null;
  }>(result.text);

  return {
    agrees: parsed.agrees ?? false,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    issues: parsed.issues ?? [],
    suggestedLagrum: parsed.suggested_lagrum ?? null,
    provider: result.provider,
    model: result.model,
    raw: parsed,
  };
}

export function reviewerLabel(): string {
  return modelLabel("reviewer");
}
