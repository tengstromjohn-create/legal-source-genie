// =============================================================================
// Modellabstraktion. Roller (extractor, reviewer, classifier, responder) mappas
// till modell + leverantör via miljövariabler — modellbyte är konfiguration,
// inte kodändring. Grund för den kvalitetssäkrande pipelinen i fas 0.4.
// =============================================================================

export type Role = "extractor" | "reviewer" | "classifier" | "responder";

interface ModelConfig {
  provider: "anthropic" | "openai";
  model: string;
}

// Standardval enligt utvecklingsplanen. Kan överstyras per roll med env, t.ex.
// LSG_EXTRACTOR_MODEL="openai:gpt-5-2025-08-07".
const DEFAULTS: Record<Role, ModelConfig> = {
  extractor: { provider: "anthropic", model: "claude-sonnet-4-6" },
  reviewer: { provider: "openai", model: "gpt-5-2025-08-07" },
  classifier: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  responder: { provider: "anthropic", model: "claude-sonnet-4-6" },
};

function resolve(role: Role): ModelConfig {
  const raw = Deno.env.get(`LSG_${role.toUpperCase()}_MODEL`);
  if (raw && raw.includes(":")) {
    const [provider, ...rest] = raw.split(":");
    if (provider === "anthropic" || provider === "openai") {
      return { provider, model: rest.join(":") };
    }
  }
  return DEFAULTS[role];
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

export async function complete(req: CompletionRequest): Promise<CompletionResult> {
  const cfg = resolve(req.role);
  const text = cfg.provider === "anthropic"
    ? await callAnthropic(cfg, req)
    : await callOpenAI(cfg, req);
  return { text, model: cfg.model, provider: cfg.provider };
}

export function modelLabel(role: Role): string {
  const cfg = resolve(role);
  return `${cfg.provider}:${cfg.model}`;
}

// Tolka modellsvar som JSON även om det är inramat i markdown-block.
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
