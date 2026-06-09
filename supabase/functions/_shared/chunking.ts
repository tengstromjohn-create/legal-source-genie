// =============================================================================
// Strukturbaserad chunkning av juridisk text.
// Delar ALDRIG mitt i en paragraf/artikel. Grupperar atomära enheter till
// chunkar under en teckengräns och bär med kapitel-/definitionskontext.
// Skalar från en ensam paragraf till tusensidiga propositioner.
// =============================================================================

export interface AtomicUnit {
  lagrum: string;
  heading?: string;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface Chunk {
  index: number;
  lagrumRef: string;
  text: string;
  charStart: number;
  charEnd: number;
  unitCount: number;
}

export type SourceKind =
  | "lag"
  | "förordning"
  | "föreskrift"
  | "eu-förordning"
  | "direktiv"
  | "annat";

const DEFAULT_MAX_CHARS = 12000;

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function segmentSwedish(text: string, regelverk: string): AtomicUnit[] {
  const pattern = /(\d+\s*kap\.\s*\d+\s*§|\d+\s*kap\.|\d+\s*[a-z]?\s*§)/gi;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) return [];

  const units: AtomicUnit[] = [];
  let currentChapter = "";

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    const marker = m[0].replace(/\s+/g, " ").trim();
    const start = m.index!;
    const end = next ? next.index! : text.length;
    const body = text.substring(start, end).trim();

    if (/^\d+\s*kap\.$/i.test(marker)) {
      currentChapter = marker;
      continue;
    }

    let lagrum: string;
    if (/^\d+\s*kap\.\s*\d+\s*[a-z]?\s*§$/i.test(marker)) {
      const chap = marker.match(/(\d+\s*kap\.)/i);
      if (chap) currentChapter = chap[1].replace(/\s+/g, " ").trim();
      lagrum = marker;
    } else {
      lagrum = currentChapter ? `${currentChapter} ${marker}` : marker;
    }

    if (body.length < 30) continue;

    units.push({
      lagrum: `${regelverk} ${lagrum}`.trim(),
      heading: currentChapter ? `${regelverk} ${currentChapter}` : regelverk,
      text: body,
      charStart: start,
      charEnd: end,
    });
  }
  return units;
}

function segmentEu(text: string, regelverk: string): AtomicUnit[] {
  const pattern = /(Artikel\s+\d+[a-z]?)/gi;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) return [];

  const units: AtomicUnit[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    const marker = m[0].replace(/\s+/g, " ").trim();
    const start = m.index!;
    const end = next ? next.index! : text.length;
    const body = text.substring(start, end).trim();
    if (body.length < 30) continue;
    units.push({
      lagrum: `${marker} ${regelverk}`.trim(),
      heading: regelverk,
      text: body,
      charStart: start,
      charEnd: end,
    });
  }
  return units;
}

function segmentFallback(text: string, regelverk: string): AtomicUnit[] {
  const parts = text.split(/\n\s*\n/).filter((p) => p.trim().length > 40);
  let offset = 0;
  return parts.map((p, i) => {
    const charStart = text.indexOf(p, offset);
    offset = charStart + p.length;
    return {
      lagrum: `${regelverk} (stycke ${i + 1})`,
      heading: regelverk,
      text: p.trim(),
      charStart,
      charEnd: offset,
    };
  });
}

export function segment(
  rawText: string,
  regelverk: string,
  kind: SourceKind,
): AtomicUnit[] {
  const text = normalize(rawText);
  let units: AtomicUnit[] = [];

  if (kind === "eu-förordning" || kind === "direktiv") {
    units = segmentEu(text, regelverk);
    if (units.length === 0) units = segmentSwedish(text, regelverk);
  } else {
    units = segmentSwedish(text, regelverk);
    if (units.length === 0) units = segmentEu(text, regelverk);
  }
  if (units.length === 0) units = segmentFallback(text, regelverk);
  return units;
}

function buildContextHeader(units: AtomicUnit[], cap: number): string {
  if (cap <= 0) return "";
  const defs = units.filter((u) =>
    /\b1\s*kap\./i.test(u.lagrum) || /Artikel\s+[1-4]\b/i.test(u.lagrum)
  );
  if (defs.length === 0) return "";
  const joined = defs.map((d) => `${d.lagrum}: ${d.text}`).join("\n");
  const capped = joined.length > cap ? joined.substring(0, cap) + " […]" : joined;
  return `[Definitionskontext]\n${capped}\n[/Definitionskontext]\n\n`;
}

export function chunk(
  units: AtomicUnit[],
  maxChars: number = DEFAULT_MAX_CHARS,
): Chunk[] {
  if (units.length === 0) return [];

  // Kontextrubriken får ta högst en fjärdedel av gränsen, så att
  // rubrik + innehåll tillsammans garanterat ryms under maxChars.
  const headerCap = Math.min(2000, Math.floor(maxChars * 0.2));
  const contextHeader = buildContextHeader(units, headerCap);
  const budget = Math.max(500, maxChars - contextHeader.length);
  const chunks: Chunk[] = [];

  let bucket: AtomicUnit[] = [];
  let bucketLen = 0;

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const heading = first.heading ? `[${first.heading}]\n` : "";
    const body = bucket.map((u) => `${u.lagrum}\n${u.text}`).join("\n\n");
    chunks.push({
      index: chunks.length,
      lagrumRef: first.lagrum === last.lagrum
        ? first.lagrum
        : `${first.lagrum} – ${last.lagrum}`,
      text: contextHeader + heading + body,
      charStart: first.charStart,
      charEnd: last.charEnd,
      unitCount: bucket.length,
    });
    bucket = [];
    bucketLen = 0;
  };

  for (const u of units) {
    const unitLen = u.lagrum.length + u.text.length + 2;
    if (unitLen > budget && bucket.length === 0) {
      bucket.push(u);
      flush();
      continue;
    }
    if (bucketLen + unitLen > budget) flush();
    bucket.push(u);
    bucketLen += unitLen;
  }
  flush();
  return chunks;
}

export function buildChunks(
  rawText: string,
  regelverk: string,
  kind: SourceKind,
  maxChars: number = DEFAULT_MAX_CHARS,
): Chunk[] {
  return chunk(segment(rawText, regelverk, kind), maxChars);
}
