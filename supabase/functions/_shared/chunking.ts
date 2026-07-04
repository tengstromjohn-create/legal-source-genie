// =============================================================================
// Strukturbaserad segmentering av svensk lagtext — omskriven 2026-07-05 efter
// audit (felmärkta chunkar i 37 % av ABL-jobbet). Principer:
//
//  1. Endast RADLEDANDE markörer räknas som struktur. Inline-hänvisningar
//     ("...enligt 4 kap. 12 §") kan aldrig starta en enhet.
//  2. SEKVENSVALIDERING som acceptanskriterium: kapitel och paragrafer måste
//     följa dokumentordningen (1 kap. → 2 kap. → ... , 4 § → 4 a § → 5 §).
//     En radledande träff som bryter sekvensen (t.ex. radbruten inline-
//     hänvisning) avvisas.
//  3. Bokstavskapitel (16 a kap., 24 a kap.) och bokstavsparagrafer (49 b §)
//     stöds fullt ut.
//  4. Resultatet valideras: täckningsgrad och enhetsantal under tröskel ger
//     fel — importen ska stoppas i stället för att tyst producera skräp.
//
// Segmenteringen producerar ett paragrafindex (provisions) som blir systemets
// facit (tabellen source_provision) och som chunkarna byggs från.
// =============================================================================

export interface Provision {
  kapitel: string | null; // "24 a" | "8" | null (kapitellös lag)
  paragraf: string;       // "4" | "4 a"
  label: string;          // "24 a kap. 4 a §" | "15 §" | "Artikel 5"
  heading?: string;       // närmast föregående mellanrubrik
  text: string;
  charStart: number;      // offset i normaliserad text (CRLF→LF)
  charEnd: number;
}

export interface SegmentationResult {
  provisions: Provision[];
  warnings: string[];
  errors: string[];
  coverage: number; // andel av brödtexten som hamnat i enheter (0–1)
  ok: boolean;
}

export interface Chunk {
  index: number;
  lagrumRef: string;
  text: string;
  charStart: number;
  charEnd: number;
  unitCount: number;
  provisionLabels: string[];
}

export type SourceKind =
  | "lag"
  | "förordning"
  | "föreskrift"
  | "eu-förordning"
  | "direktiv"
  | "annat";

const DEFAULT_MAX_CHARS = 12000;
const MIN_COVERAGE = 0.7;
const MIN_PROVISIONS = 3;

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
}

function nextLetter(l: string): string {
  if (l === "") return "a";
  return String.fromCharCode(l.charCodeAt(0) + 1);
}

// Kapitelrubrik på egen rad: "24 a kap. Gränsöverskridande ombildning"
const CHAPTER_RE = /^(\d{1,3})(?: ([a-z]))? kap\.(?: (.*))?$/;
// Paragrafstart på egen rad: "4 a § Text..." eller "4 §" ensamt
const PARA_RE = /^(\d{1,3})(?: ?([a-z]))? § ?(.*)$/;
// EU-artikel på egen rad: "Artikel 5" eller "Artikel 5a"
const ARTICLE_RE = /^Artikel (\d{1,3}) ?([a-z])?\b ?(.*)$/i;

interface ChapterState { num: number; letter: string; label: string | null }

function segmentSwedish(
  text: string,
  warnings: string[],
): Provision[] {
  const lines = text.split("\n");
  const provisions: Provision[] = [];

  let chap: ChapterState = { num: 0, letter: "", label: null };
  let parNum = 0;
  let parLetter = "";
  let current: Provision | null = null;
  let pendingHeading: string | null = null;
  let offset = 0;

  const closeCurrent = (end: number) => {
    if (current) {
      current.text = current.text.trim();
      current.charEnd = end;
      if (current.text.length >= 10) provisions.push(current);
      current = null;
    }
  };

  const acceptChapter = (n: number, l: string): boolean => {
    // Framåt-monotoni är kravet: kapitel kan aldrig gå bakåt. Stora hopp
    // (upphävda kapitel) accepteras med varning i stället för dödläge.
    let ok: boolean;
    if (l === "") {
      ok = n > chap.num;
    } else if (n === chap.num && l === nextLetter(chap.letter)) {
      // Bokstavskapitel i följd: 16 kap. → 16 a kap. → 16 b kap.
      ok = true;
    } else {
      // Direktinträde i bokstavskapitel (grundkapitlet upphävt): 24 a kap.
      ok = l === "a" && n > chap.num;
    }
    if (ok && n > chap.num + 3) {
      warnings.push(`Kapitelhopp ${chap.label ?? "start"} → ${n}${l ? ` ${l}` : ""} kap.`);
    }
    return ok;
  };

  const acceptParagraph = (n: number, l: string): boolean => {
    // Framåt-monotoni inom kapitlet; stora hopp accepteras med varning.
    let ok: boolean;
    if (l === "") {
      ok = n > parNum;
    } else if (n === parNum && l === nextLetter(parLetter)) {
      // Bokstavsparagraf i följd: 49 § → 49 a § → 49 b §.
      ok = true;
    } else {
      // Direktinträde i bokstavsparagraf (grundnumret upphävt): 4 a § efter 3 §.
      ok = l === "a" && n > parNum;
    }
    if (ok && n > parNum + 40) {
      warnings.push(`Paragrafhopp i ${chap.label ?? "kapitellös lag"}: ${parNum} § → ${n}${l ? ` ${l}` : ""} §`);
    }
    return ok;
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1; // +1 för radbrytningen
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const chapM = trimmed.match(CHAPTER_RE);
    if (chapM) {
      const n = parseInt(chapM[1], 10);
      const l = chapM[2] ?? "";
      const rubrik = (chapM[3] ?? "").trim();
      const rubrikOk = rubrik.length > 0 && /^[A-ZÅÄÖ]/.test(rubrik);
      if (rubrikOk && acceptChapter(n, l)) {
        closeCurrent(lineStart);
        chap = {
          num: n,
          letter: l,
          label: `${n}${l ? ` ${l}` : ""} kap.`,
        };
        parNum = 0;
        parLetter = "";
        pendingHeading = rubrik || null;
        continue;
      } else if (rubrikOk && (n !== chap.num || l !== chap.letter)) {
        // Radledande kapitelkandidat som bryter sekvensen — sannolikt
        // radbruten inline-hänvisning. Avvisas, men logga för spårbarhet.
        warnings.push(
          `Avvisad kapitelkandidat "${trimmed.substring(0, 40)}" efter ${chap.label ?? "start"}`,
        );
        // Behandla som löptext (faller igenom nedan).
      }
    }

    const paraM = trimmed.match(PARA_RE);
    if (paraM) {
      const n = parseInt(paraM[1], 10);
      const l = paraM[2] ?? "";
      const rest = (paraM[3] ?? "").trim();
      const restOk = rest === "" ||
        /^[A-ZÅÄÖ0-9/"'(–-]/.test(rest) ||
        /^har upphävts/i.test(rest);
      if (restOk && acceptParagraph(n, l)) {
        closeCurrent(lineStart);
        parNum = n;
        parLetter = l;
        const parLabel = `${n}${l ? ` ${l}` : ""} §`;
        const label = chap.num > 0 ? `${chap.label} ${parLabel}` : parLabel;
        current = {
          kapitel: chap.num > 0 ? `${chap.num}${chap.letter ? ` ${chap.letter}` : ""}` : null,
          paragraf: `${n}${l ? ` ${l}` : ""}`,
          label,
          heading: pendingHeading ?? undefined,
          text: (paraM[3] ?? "").trim(),
          charStart: lineStart,
          charEnd: offset,
        };
        continue;
      }
      // Sekvensbrott (inline-hänvisning i radbruten text) → löptext.
    }

    if (current) {
      current.text += (current.text ? "\n" : "") + trimmed;
    } else if (!chapM && !paraM && trimmed.length < 120 && !/[.:;]$/.test(trimmed)) {
      // Trolig mellanrubrik före nästa paragraf.
      pendingHeading = trimmed;
    }
  }
  closeCurrent(offset);
  return provisions;
}

function segmentEu(text: string, warnings: string[]): Provision[] {
  const lines = text.split("\n");
  const provisions: Provision[] = [];
  let artNum = 0;
  let artLetter = "";
  let current: Provision | null = null;
  let offset = 0;

  const closeCurrent = (end: number) => {
    if (current) {
      current.text = current.text.trim();
      current.charEnd = end;
      if (current.text.length >= 10) provisions.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const m = trimmed.match(ARTICLE_RE);
    if (m) {
      const n = parseInt(m[1], 10);
      const l = (m[2] ?? "").toLowerCase();
      const ok = l === ""
        ? n > artNum && n <= artNum + 10
        : (n === artNum && l === nextLetter(artLetter)) || (n === artNum + 1 && l === "a");
      if (ok) {
        closeCurrent(lineStart);
        artNum = n;
        artLetter = l;
        const label = `Artikel ${n}${l}`;
        current = {
          kapitel: null,
          paragraf: `${n}${l}`,
          label,
          text: (m[3] ?? "").trim(),
          charStart: lineStart,
          charEnd: offset,
        };
        continue;
      }
      warnings.push(`Avvisad artikelkandidat "${trimmed.substring(0, 40)}"`);
    }
    if (current) current.text += (current.text ? "\n" : "") + trimmed;
  }
  closeCurrent(offset);
  return provisions;
}

export function segmentSource(
  rawText: string,
  _regelverk: string,
  kind: SourceKind,
): SegmentationResult {
  const text = normalize(rawText);
  const warnings: string[] = [];
  const errors: string[] = [];

  let provisions: Provision[];
  if (kind === "eu-förordning" || kind === "direktiv") {
    provisions = segmentEu(text, warnings);
    if (provisions.length === 0) provisions = segmentSwedish(text, warnings);
  } else {
    provisions = segmentSwedish(text, warnings);
    if (provisions.length === 0) provisions = segmentEu(text, warnings);
  }

  // Täckningsgrad: hur stor del av texten efter första enheten som fångats.
  const bodyStart = provisions.length > 0 ? provisions[0].charStart : 0;
  const bodyLength = Math.max(1, text.length - bodyStart);
  const covered = provisions.reduce((s, p) => s + (p.charEnd - p.charStart), 0);
  const coverage = Math.min(1, covered / bodyLength);

  if (provisions.length < MIN_PROVISIONS && kind !== "annat") {
    errors.push(
      `För få enheter (${provisions.length}) — texten kunde inte segmenteras strukturellt.`,
    );
  }
  if (provisions.length >= MIN_PROVISIONS && coverage < MIN_COVERAGE) {
    errors.push(
      `Låg täckningsgrad (${Math.round(coverage * 100)} %) — segmenteringen har sannolikt tappat text.`,
    );
  }

  return { provisions, warnings, errors, coverage, ok: errors.length === 0 };
}

function buildContextHeader(provisions: Provision[], cap: number): string {
  if (cap <= 0) return "";
  const defs = provisions.filter(
    (p) => p.kapitel === "1" || /^Artikel [1-4]\b/i.test(p.label),
  );
  if (defs.length === 0) return "";
  const joined = defs.map((d) => `${d.label}: ${d.text}`).join("\n");
  const capped = joined.length > cap ? joined.substring(0, cap) + " […]" : joined;
  return `[Definitionskontext]\n${capped}\n[/Definitionskontext]\n\n`;
}

export function chunkProvisions(
  provisions: Provision[],
  regelverk: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): Chunk[] {
  if (provisions.length === 0) return [];

  const headerCap = Math.min(2000, Math.floor(maxChars * 0.2));
  const contextHeader = buildContextHeader(provisions, headerCap);
  const budget = Math.max(500, maxChars - contextHeader.length);
  const chunks: Chunk[] = [];

  let bucket: Provision[] = [];
  let bucketLen = 0;

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const body = bucket
      .map((p) => `${regelverk} ${p.label}\n${p.text}`)
      .join("\n\n");
    chunks.push({
      index: chunks.length,
      lagrumRef: first.label === last.label
        ? `${regelverk} ${first.label}`
        : `${regelverk} ${first.label} – ${last.label}`,
      text: contextHeader + body,
      charStart: first.charStart,
      charEnd: last.charEnd,
      unitCount: bucket.length,
      provisionLabels: bucket.map((p) => p.label),
    });
    bucket = [];
    bucketLen = 0;
  };

  for (const p of provisions) {
    const unitLen = p.label.length + p.text.length + regelverk.length + 3;
    if (unitLen > budget && bucket.length === 0) {
      bucket.push(p);
      flush();
      continue;
    }
    if (bucketLen + unitLen > budget) flush();
    bucket.push(p);
    bucketLen += unitLen;
  }
  flush();
  return chunks;
}

// Bakåtkompatibelt API. Kastar fel om segmenteringen inte klarar validering —
// anroparen ska stoppa importen, inte fortsätta med skräp.
export function buildChunks(
  rawText: string,
  regelverk: string,
  kind: SourceKind,
  maxChars: number = DEFAULT_MAX_CHARS,
): Chunk[] {
  const result = segmentSource(rawText, regelverk, kind);
  if (!result.ok) {
    throw new Error(`Segmentering misslyckades: ${result.errors.join("; ")}`);
  }
  return chunkProvisions(result.provisions, regelverk, maxChars);
}
