// =============================================================================
// Modellabstraktion. Roller (extractor, reviewer, reviewer_b, arbiter,
// classifier, responder) mappas till leverantör + modell + promptversion via
// konfigtabellen model_role_config: senaste raden per roll där
// active_from <= now(). Modellbyte är därmed en konfigurationsändring —
// ingen koddeploy krävs.
// Fallbackordning: model_role_config → env (LSG_<ROLL>_MODEL) → DEFAULTS.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type Role =
  | "extractor"
  | "reviewer"
  | "reviewer_b"
  | "arbiter"
  | "classifier"
  | "responder";

export type Provider = "anthropic" | "openai" | "google";

export interface ModelConfig {
  provider: Provider;
  model: string;
  promptVersion: string;
}

function isProvider(v: unknown): v is Provider {
  return v === "anthropic" || v === "openai" || v === "google";
}

// Sista utväg om konfigtabellen inte kan läsas och env saknas.
// Matris enligt utvecklingsplanen rev. 2026-07-03 + beslut 12 (reviewer_b,
// tredje modellfamilj). Strängar verifierade mot docs.claude.com,
// developers.openai.com (2026-07-04) och ai.google.dev (2026-07-05).
const DEFAULTS: Record<Role, ModelConfig> = {
  extractor: { provider: "anthropic", model: "claude-sonnet-5", promptVersion: "v1" },
  reviewer: { provider: "openai", model: "gpt-5.5", promptVersion: "v1" },
  reviewer_b: { provider: "google", model: "gemini-3.5-flash", promptVersion: "v1" },
  arbiter: { provider: "anthropic", model: "claude-opus-4-8", promptVersion: "v1" },
  classifier: { provider: "anthropic", model: "claude-haiku-4-5-20251001", promptVersion: "v1" },
  responder: { provider: "anthropic", model: "claude-sonnet-5", promptVersion: "v1" },
};

// Kort TTL-cache per isolat: konfigändring slår igenom inom en minut utan
// att varje complete() kostar en extra DB-rundresa.
const CACHE_TTL_MS = 60_000;
const cache = new Map<Role, { cfg: ModelConfig; at: number }>();

function envOverride(role: Role): ModelConfig | null {
  const raw = Deno.env.get(`LSG_${role.toUpperCase()}_MODEL`);
  if (raw && raw.includes(":")) {
    const [provider, ...rest] = raw.split(":");
    if (isProvider(provider)) {
      return { provider, model: rest.join(":"), promptVersion: "env" };
    }
  }
  return null;
}

async function fromConfigTable(role: Role): Promise<ModelConfig | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("model_role_config")
      .select("provider, model, prompt_version")
      .eq("role", role)
      .lte("active_from", new Date().toISOString())
      .order("active_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    if (!isProvider(data.provider)) return null;
    return {
      provider: data.provider,
      model: data.model,
      promptVersion: data.prompt_version ?? "v1",
    };
  } catch {
    return null;
  }
}

export async function resolveRole(role: Role): Promise<ModelConfig> {
  const hit = cache.get(role);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.cfg;
  const cfg = (await fromConfigTable(role)) ?? envOverride(role) ?? DEFAULTS[role];
  cache.set(role, { cfg, at: Date.now() });
  return cfg;
}

export interface CompletionRequest {
  role: Role;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: string;
  promptVersion: string;
  latencyMs: number;
}

async function callAnthropic(
  cfg: ModelConfig,
  req: CompletionRequest,
): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY saknas");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 8000,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.substring(0, 300)}`);
  }
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

async function callOpenAI(
  cfg: ModelConfig,
  req: CompletionRequest,
): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY saknas");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      max_completion_tokens: req.maxTokens ?? 8000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.substring(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Gemini API (generativelanguage.googleapis.com). Endpoint och svarformat
// verifierade mot ai.google.dev/api 2026-07-05.
async function callGemini(
  cfg: ModelConfig,
  req: CompletionRequest,
): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY/GOOGLE_API_KEY saknas");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: { maxOutputTokens: req.maxTokens ?? 8000 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.substring(0, 300)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p: { text?: unknown }) => typeof p.text === "string")
    .map((p: { text: string }) => p.text)
    .join("");
}

export async function complete(req: CompletionRequest): Promise<CompletionResult> {
  const cfg = await resolveRole(req.role);
  const started = Date.now();
  let text: string;
  switch (cfg.provider) {
    case "anthropic":
      text = await callAnthropic(cfg, req);
      break;
    case "openai":
      text = await callOpenAI(cfg, req);
      break;
    case "google":
      text = await callGemini(cfg, req);
      break;
  }
  return {
    text,
    model: cfg.model,
    provider: cfg.provider,
    promptVersion: cfg.promptVersion,
    latencyMs: Date.now() - started,
  };
}

export async function modelLabel(role: Role): Promise<string> {
  const cfg = await resolveRole(role);
  return `${cfg.provider}:${cfg.model}`;
}

// Tolka modellsvar som JSON även om det är inramat i markdown-block.
// Behålls som skyddsnät för svar från andra providers; ersätts för Claude
// av structured outputs i block 3.
export function parseJsonResponse<T>(content: string): T {
  let s = content.trim();
  if (s.startsWith("```")) {
    const m = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    s = m ? m[1].trim() : s.replace(/^```(?:json)?\s*\n?/, "");
  }
  const t = s.trim();
  if (!t.endsWith("}") && !t.endsWith("]")) {
    throw new Error("Modellsvaret ser trunkerat ut");
  }
  return JSON.parse(t) as T;
}
