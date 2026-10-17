import type { Annotation, AtsCheck, ExtractedResume, Fix, ResumeAnalysis, ResumeLine, Severity, AnnotationType } from "@/lib/types";
import { clamp } from "@/lib/utils";
import {
  ALL_KEYWORDS,
  CLICHES,
  FAMILY_KEYWORDS,
  FAMILY_LABEL,
  TOOL_VOCAB,
  countTerm,
  detectFamily,
  termRegex,
  type RoleFamily,
} from "./lexicon";
import { findWeakPhrase, hasMetric, isStrongOpener, rewriteBullet, splitLongBullet, stripBullet } from "./rewrite";

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

export type SectionKey =
  | "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "awards" | "other";

const SECTION_PATTERNS: [SectionKey, RegExp][] = [
  ["experience", /^(professional |work |relevant |industry )?(experience|employment( history)?|work history|career history|professional background)$/],
  ["education", /^(education|academic background|academics|education (and|&) training|qualifications)$/],
  ["skills", /^((technical |core |key |relevant )?skills( (and|&) (tools|interests|certifications))?|core competencies|competencies|technical proficiencies|tools( (and|&) technologies)?|technologies|expertise)$/],
  ["projects", /^((selected |key |personal |academic )?projects)$/],
  ["summary", /^(summary|professional summary|profile|professional profile|about( me)?|objective|career objective|career summary)$/],
  ["certifications", /^(certifications?|licenses( (and|&) certifications)?|certificates|courses)$/],
  ["awards", /^(awards|honors|honours|achievements|accomplishments|awards (and|&) honors)$/],
  ["other", /^(volunteer(ing)?( experience)?|publications|languages|interests|leadership|activities|references)$/],
];

const STANDARD_BULLET = /^\s*[•●▪◦‣∙·\-–—*]\s*/u;
const FANCY_BULLET = /^\s*([»►▶➤➢➔→✓✔★☆◆◇■□❖]|[-])\s*/u;
const PUA = /[-]/u;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/;
const LINKEDIN = /linkedin\.com\/in\/|linkedin/i;

const DATE_STYLES: [string, RegExp][] = [
  ["Mon YYYY", /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.? (19|20)\d{2}\b/i],
  ["Month YYYY", /\b(january|february|march|april|june|july|august|september|october|november|december) (19|20)\d{2}\b/i],
  ["MM/YYYY", /\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b/],
  ["MM-YYYY", /\b(0?[1-9]|1[0-2])-(19|20)\d{2}\b/],
  ["Mon 'YY", /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* '\d{2}\b/i],
];
// Year-only ranges ("2012 – 2016") are conventional for education, so they don't count as a clash.
const DATE_ANY = /\b(19|20)\d{2}\b|\bpresent\b/i;

function normHeader(text: string) {
  return text.toLowerCase().replace(/[:|_•·]/g, "").replace(/\s+/g, " ").trim();
}

function sectionOf(line: ResumeLine): SectionKey | null {
  // Multi-column rows ("SKILLS      CERTIFICATIONS") are matched on their first run.
  const candidates = line.segments.length > 1 ? [line.text, line.segments[0].text] : [line.text];
  for (const raw of candidates) {
    const t = normHeader(raw);
    if (t.length > 42 || t.split(" ").length > 5) continue;
    for (const [key, re] of SECTION_PATTERNS) if (re.test(t)) return key;
  }
  return null;
}

interface Block {
  id: string;
  section: SectionKey | "header";
  lines: ResumeLine[];
  text: string;
  bulleted: boolean;
  fancyBullet: boolean;
}

function unionBox(lines: ResumeLine[]) {
  const x = Math.min(...lines.map((l) => l.x));
  const y = Math.min(...lines.map((l) => l.y));
  const r = Math.max(...lines.map((l) => l.x + l.w));
  const b = Math.max(...lines.map((l) => l.y + l.h));
  return { page: lines[0].page, x, y, width: r - x, height: b - y };
}

const wordCount = (s: string) => (s.match(/[A-Za-z0-9][\w'’%$.+-]*/g) || []).length;

/** Group lines into statement blocks (bullets + their wrapped continuation lines). */
function buildBlocks(lines: ResumeLine[]) {
  const blocks: Block[] = [];
  const headers: { key: SectionKey; line: ResumeLine }[] = [];
  let section: SectionKey | "header" = "header";
  let open: Block | null = null;

  lines.forEach((line, i) => {
    const key = sectionOf(line);
    if (key) {
      section = key;
      headers.push({ key, line });
      open = null;
      return;
    }
    const isBullet = STANDARD_BULLET.test(line.text) || FANCY_BULLET.test(line.text);
    const prev = lines[i - 1];
    const sameFlow =
      open &&
      prev &&
      prev.page === line.page &&
      line.y - (prev.y + prev.h) < prev.h * 0.9 &&
      line.segments.length === 1 &&
      !isBullet;

    const blockOpen = open as Block | null;
    const lastText = blockOpen?.lines[blockOpen.lines.length - 1]?.text || "";
    const continues = sameFlow && blockOpen && (/^[a-z(]/.test(line.text) || !/[.!?:]$/.test(lastText)) && !DATE_ANY.test(line.text.slice(-12));

    if (continues && blockOpen) {
      blockOpen.lines.push(line);
      blockOpen.text = `${blockOpen.text} ${line.text}`;
      return;
    }

    const words = wordCount(line.text);
    const statementish = !isBullet && words >= 8 && line.segments.length === 1 && !/[|]/.test(line.text);
    if (isBullet || (statementish && section !== "header" && section !== "skills" && section !== "education")) {
      open = {
        id: line.id,
        section,
        lines: [line],
        text: line.text,
        bulleted: isBullet,
        fancyBullet: FANCY_BULLET.test(line.text),
      };
      blocks.push(open);
    } else {
      open = null;
    }
  });

  return { blocks, headers };
}

/* ------------------------------------------------------------------ */
/* Keywords                                                            */
/* ------------------------------------------------------------------ */

function jdKeywords(jd: string): string[] {
  const vocab = Array.from(new Set([...ALL_KEYWORDS, ...TOOL_VOCAB]));
  const hits = vocab
    .map((term) => ({ term, n: countTerm(jd, term) }))
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n || b.term.length - a.term.length);
  // drop terms fully contained in a longer hit ("testing" inside "A/B testing")
  const out: string[] = [];
  for (const h of hits) {
    if (out.some((o) => o.toLowerCase().includes(h.term.toLowerCase()))) continue;
    out.push(h.term);
  }
  return out.slice(0, 24);
}

function keywordAnalysis(text: string, family: RoleFamily, jobDescription?: string) {
  const fromJd = jobDescription && jobDescription.trim().length > 80 ? jdKeywords(jobDescription) : [];
  const source: "job-description" | "role-profile" = fromJd.length >= 5 ? "job-description" : "role-profile";
  const expected = source === "job-description" ? fromJd : FAMILY_KEYWORDS[family];
  const matched = expected.filter((k) => termRegex(k).test(text));
  const missing = expected.filter((k) => !matched.includes(k));
  const target = source === "job-description" ? Math.max(6, Math.round(expected.length * 0.8)) : 12;
  const score = clamp(Math.round((matched.length / target) * 100), 0, 100);

  const total = wordCount(text) || 1;
  const keywordWords = matched.reduce((sum, k) => sum + countTerm(text, k) * k.split(/\s+/).length, 0);
  const density = Math.round((keywordWords / total) * 1000) / 10;
  return { matched, missing: missing.slice(0, 12), source, score, density };
}

/* ------------------------------------------------------------------ */
/* Analyzer                                                            */
/* ------------------------------------------------------------------ */

interface Issue {
  severity: Severity;
  type: AnnotationType;
  title: string;
  note: string;
}

export interface AnalyzeOptions {
  jobDescription?: string;
  targetRole?: string;
}

export function analyzeResumeHeuristic(resume: ExtractedResume, opts: AnalyzeOptions = {}): ResumeAnalysis {
  const t0 = Date.now();
  const lines = resume.lines;
  const fullText = lines.map((l) => l.text).join("\n");
  const words = wordCount(fullText);
  const annotations: Annotation[] = [];
  const fixes: Fix[] = [];
  const warnings: string[] = [];
  let annId = 0;
  const add = (box: ReturnType<typeof unionBox>, a: Omit<Annotation, "id" | "page" | "x" | "y" | "width" | "height">) => {
    const pad = 0.004;
    const ann: Annotation = {
      id: `a${++annId}`,
      page: box.page,
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(1, box.width + pad * 2),
      height: box.height + pad * 2,
      ...a,
    };
    annotations.push(ann);
    return ann.id;
  };

  /* ---------- no text layer ---------- */
  if (words < 40) {
    const id = add({ page: 1, x: 0.06, y: 0.05, width: 0.88, height: 0.2 }, {
      type: "ats",
      severity: "critical",
      title: "No machine-readable text",
      originalText: lines.slice(0, 3).map((l) => l.text).join(" ") || "(no text layer found)",
      suggestedText: "Export the resume from Word / Google Docs as a text-based PDF (File → Download → PDF). Avoid scanning or 'Print to image'.",
      note: "This PDF is an image or outlines-only. Most ATS parsers will read it as a blank page — your application gets auto-rejected before a human sees it.",
    });
    return finalize({
      resume, opts, annotations, fixes: [{ id: "f-text", priority: "high", title: "Re-export as a text-based PDF", detail: "Nothing else matters until the ATS can read your words.", annotationIds: [id], impact: 60 }],
      checks: [{ id: "text", label: "Machine-readable text", status: "fail", detail: "No selectable text detected." }],
      sections: [], scores: { ats: 12, impact: 20, keywords: 0, formatting: 30 }, bulletStats: { total: 0, quantified: 0, strong: 0, weak: 0 },
      keywordInfo: { matched: [], missing: FAMILY_KEYWORDS.general.slice(0, 8), source: "role-profile", density: 0, family: "general" },
      warnings, t0, summary: "We couldn't read any text in this PDF — an ATS can't either. Re-export it as a text-based PDF and run the audit again.",
    });
  }

  const { blocks, headers } = buildBlocks(lines);
  const found = new Set(headers.map((h) => h.key));
  const topLine = lines.find((l) => l.page === 1) || lines[0];
  const nameBox = unionBox([topLine]);

  /* ---------- role & keywords ---------- */
  const titleHint = lines.slice(0, 3).map((l) => l.text).join(" ");
  const family = detectFamily(opts.targetRole, opts.jobDescription?.slice(0, 400), titleHint, fullText.slice(0, 1500));
  const kw = keywordAnalysis(fullText, family, opts.jobDescription);

  /* ---------- per-statement content checks ---------- */
  const contentBlocks = blocks.filter((b) => b.section === "experience" || b.section === "projects" || (b.bulleted && b.section !== "skills" && b.section !== "education"));
  let quantified = 0;
  let strong = 0;
  let weak = 0;
  const noMetricIds: string[] = [];
  const weakIds: string[] = [];
  const positiveCandidates: { block: Block; score: number }[] = [];
  let impactAnnotations = 0;
  const MAX_IMPACT_FLAGS = 9;

  for (const b of contentBlocks) {
    const body = stripBullet(b.text);
    const n = wordCount(body);
    if (n < 4) continue;
    const metric = hasMetric(body);
    const weakPhrase = findWeakPhrase(body);
    const strongOpen = isStrongOpener(body);
    const pronoun = /\b(I|me|my|myself)\b/.test(body);
    if (metric) quantified++;
    if (strongOpen) strong++;
    if (weakPhrase) weak++;

    const issues: Issue[] = [];
    if (weakPhrase) {
      issues.push({
        severity: "critical",
        type: "impact",
        title: metric ? "Passive opener" : "Passive opener, no metric",
        note: `“${weakPhrase.label}” describes a duty, not an outcome. Recruiters skim the first 2–3 words of each bullet — lead with a strong verb${metric ? "" : " and end with a measurable result"}.`,
      });
    } else if (!metric && n >= 6) {
      issues.push({
        severity: "warning",
        type: "impact",
        title: "No quantified result",
        note: "There's no number here. Add scale (team size, users, budget) or an outcome (%, $, time saved) so the reader can size your impact.",
      });
    }
    if (pronoun) {
      issues.push({ severity: "warning", type: "impact", title: "First-person pronoun", note: "Drop “I / my” — resume bullets are implied first person and pronouns read as informal to recruiters." });
    }
    if (n > 38) {
      issues.push({ severity: "warning", type: "impact", title: "Bullet too long", note: `${n} words. Bullets over ~2 lines get skimmed past. Split into two outcomes or cut the context.` });
    }

    if (issues.length) {
      const lead = issues.sort((a, z) => (a.severity === "critical" ? -1 : 0) - (z.severity === "critical" ? -1 : 0))[0];
      if (lead.severity === "critical" || impactAnnotations < MAX_IMPACT_FLAGS) {
        const id = add(unionBox(b.lines), {
          type: lead.type,
          severity: lead.severity,
          title: lead.title,
          originalText: body,
          suggestedText: n > 38 ? splitLongBullet(body) : rewriteBullet(body),
          note: issues.map((i) => i.note).join(" "),
        });
        impactAnnotations++;
        if (weakPhrase) weakIds.push(id);
        else if (!metric) noMetricIds.push(id);
      }
    } else if (metric && strongOpen) {
      const digits = (body.match(/\d+/g) || []).length;
      positiveCandidates.push({ block: b, score: digits * 2 + (/%|\$|₹|€|£/.test(body) ? 3 : 0) + Math.min(n, 25) / 10 });
    }
  }

  positiveCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .forEach(({ block }) => {
      const body = stripBullet(block.text);
      add(unionBox(block.lines), {
        type: "impact",
        severity: "positive",
        title: "Quantified impact",
        originalText: body,
        suggestedText: body,
        note: "Strong action verb + a concrete result. This is the pattern every bullet should follow — keep it near the top of the role.",
      });
    });

  /* ---------- clichés & outdated lines ---------- */
  let cliches = 0;
  for (const line of lines) {
    const lower = line.text.toLowerCase();
    if (/references (are )?available (up)?on request/.test(lower)) {
      add(unionBox([line]), {
        type: "impact",
        severity: "warning",
        title: "Outdated line",
        originalText: line.text,
        suggestedText: "(Remove this line — use the space for one more quantified achievement.)",
        note: "“References available upon request” is assumed by every employer and wastes prime space.",
      });
      continue;
    }
    const hits = CLICHES.filter((c) => lower.includes(c));
    if (hits.length && cliches < 3) {
      cliches++;
      let cleaned = line.text;
      for (const h of hits) cleaned = cleaned.replace(new RegExp(h.replace(/-/g, "[- ]?"), "i"), "");
      cleaned = cleaned
        .replace(/\b(and|or)\s+(with|and|or)\b/gi, "$2")
        .replace(/\s*,\s*,/g, ",")
        .replace(/\s{2,}/g, " ")
        .replace(/^[,\s]+|[,\s]+$/g, "")
        .replace(/^\w/, (c) => c.toUpperCase());
      const quoted = hits.map((h) => `“${h}”`).join(" and ");
      add(unionBox([line]), {
        type: "impact",
        severity: "warning",
        title: "Generic buzzword",
        originalText: line.text,
        suggestedText: cleaned,
        note: `${quoted} ${hits.length > 1 ? "are" : "is"} among the most over-used resume phrases — recruiters discount self-descriptions. Cut ${hits.length > 1 ? "them" : "it"} and let a result prove the trait (e.g. “shipped [N] launches with zero missed deadlines”).`,
      });
    }
  }

  /* ---------- formatting & parser risks ---------- */
  let formatPenalty = 0;
  let atsPenalty = 0;
  const checks: AtsCheck[] = [{ id: "text", label: "Machine-readable text", status: "pass", detail: `${words.toLocaleString()} words extracted cleanly.` }];

  // Non-standard bullet glyphs
  const fancy = lines.filter((l) => FANCY_BULLET.test(l.text));
  if (fancy.length) {
    const first = fancy[0];
    const glyph = first.text.trim().charAt(0);
    const id = add(unionBox([first]), {
      type: "format",
      severity: "critical",
      title: "Non-standard bullet glyph",
      originalText: first.text,
      suggestedText: `• ${stripBullet(first.text)}`,
      note: `“${glyph}” (used on ${fancy.length} line${fancy.length > 1 ? "s" : ""}) is often parsed as a junk character or icon font, which can merge bullets into one garbled line. Use a plain round bullet (•) or hyphen.`,
    });
    formatPenalty += 10;
    atsPenalty += 7;
    checks.push({ id: "bullets", label: "Standard bullet characters", status: "fail", detail: `${fancy.length} line(s) use “${glyph}”.` });
    fixes.push({ id: "f-bullets", priority: "medium", title: `Replace “${glyph}” bullets with •`, detail: `${fancy.length} line(s) use a glyph many parsers mangle.`, annotationIds: [id], impact: 4 });
  } else {
    checks.push({ id: "bullets", label: "Standard bullet characters", status: "pass", detail: "Plain bullets throughout." });
  }

  const puaLines = lines.filter((l) => PUA.test(l.text) && !FANCY_BULLET.test(l.text));
  if (puaLines.length) {
    add(unionBox([puaLines[0]]), {
      type: "format",
      severity: "critical",
      title: "Icon-font characters",
      originalText: puaLines[0].text,
      suggestedText: puaLines[0].text.replace(/[-]/gu, "").trim(),
      note: "Icons (phone, mail, LinkedIn glyphs) come through as private-use characters and can corrupt the contact field. Use plain-text labels.",
    });
    formatPenalty += 8;
    atsPenalty += 6;
  }

  // Side-by-side columns: ≥3 consecutive lines with two long, non-date segments
  const columnar = (l: ResumeLine) =>
    l.segments.length >= 2 &&
    l.segments[1].x > 0.3 &&
    l.segments[1].x < 0.78 &&
    l.segments[0].text.length >= 10 &&
    l.segments[1].text.length >= 10 &&
    !DATE_ANY.test(l.segments[1].text);
  const runs: ResumeLine[][] = [];
  let run: ResumeLine[] = [];
  for (const l of lines) {
    if (columnar(l) && (!run.length || run[run.length - 1].page === l.page)) run.push(l);
    else {
      if (run.length >= 3) runs.push(run);
      run = columnar(l) ? [l] : [];
    }
  }
  if (run.length >= 3) runs.push(run);
  const columnarShare = lines.filter(columnar).length / lines.length;
  if (runs.length) {
    const r = runs.sort((a, b) => b.length - a.length)[0];
    const left = r.map((l) => l.segments[0].text).join(" · ");
    const right = r.map((l) => l.segments.slice(1).map((s) => s.text).join(" ")).join(" · ");
    const id = add(unionBox(r), {
      type: "format",
      severity: "critical",
      title: columnarShare > 0.35 ? "Multi-column layout" : "Side-by-side columns",
      originalText: r.map((l) => l.text).join("\n"),
      suggestedText: `Stack these as two single-column groups:\n${left}\n${right}`,
      note: "ATS parsers read left-to-right across the full page, so text in side-by-side columns gets interleaved (“Python Certified Scrum Master SQL…”). Keep one column; move secondary content below.",
    });
    const heavy = columnarShare > 0.35;
    formatPenalty += heavy ? 22 : 14;
    atsPenalty += heavy ? 18 : 11;
    checks.push({ id: "layout", label: "Single-column reading order", status: heavy ? "fail" : "warn", detail: `${r.length} lines are laid out side by side${heavy ? " across most of the page" : ""}.` });
    fixes.push({ id: "f-columns", priority: "high", title: "Convert side-by-side columns to a single column", detail: "Parsers interleave columns into nonsense.", annotationIds: [id], impact: heavy ? 12 : 7 });
  } else {
    checks.push({ id: "layout", label: "Single-column reading order", status: "pass", detail: "Text flows in one predictable column." });
  }

  // Tiny fonts
  const tiny = lines.filter((l) => l.fontSize < 8 && l.text.length > 12);
  if (tiny.length) {
    add(unionBox([tiny[0]]), {
      type: "format",
      severity: "warning",
      title: "Text below 8pt",
      originalText: tiny[0].text,
      suggestedText: "Set body text to 10–11pt and footnotes to at least 9pt.",
      note: `${tiny.length} line(s) are set at ~${tiny[0].fontSize}pt. Hard for humans to read and some OCR-based parsers drop it entirely.`,
    });
    formatPenalty += 5;
    atsPenalty += 2;
    checks.push({ id: "fonts", label: "Readable font size (≥ 9pt)", status: "warn", detail: `${tiny.length} line(s) under 8pt.` });
  } else {
    checks.push({ id: "fonts", label: "Readable font size (≥ 9pt)", status: "pass", detail: "All text is a readable size." });
  }

  // Date consistency
  const dateUse = new Map<string, ResumeLine[]>();
  for (const l of lines) {
    for (const [style, re] of DATE_STYLES) {
      if (re.test(l.text)) {
        dateUse.set(style, [...(dateUse.get(style) || []), l]);
        break;
      }
    }
  }
  if (dateUse.size >= 2) {
    const sorted = [...dateUse.entries()].sort((a, b) => b[1].length - a[1].length);
    const [majority] = sorted[0];
    const [minority, minorityLines] = sorted[sorted.length - 1];
    const id = add(unionBox([minorityLines[0]]), {
      type: "format",
      severity: "warning",
      title: "Inconsistent date format",
      originalText: minorityLines[0].text,
      suggestedText: `Use one format everywhere — “${majority}” (e.g. “Jan 2021 – Mar 2023”).`,
      note: `This resume mixes ${sorted.map(([s]) => `“${s}”`).join(" and ")}. ATS tools calculate tenure from dates; mixed formats (“${minority}” here) can mis-compute your years of experience.`,
    });
    formatPenalty += 4;
    atsPenalty += 4;
    checks.push({ id: "dates", label: "Consistent date format", status: "warn", detail: `${dateUse.size} formats in use.` });
    fixes.push({ id: "f-dates", priority: "low", title: `Standardise dates to “${majority}”`, detail: "Keeps tenure calculations accurate.", annotationIds: [id], impact: 2 });
  } else {
    checks.push({ id: "dates", label: "Consistent date format", status: "pass", detail: dateUse.size ? "One date style throughout." : "No dates detected." });
  }

  // Contact block
  const top = lines.filter((l) => l.page === 1).slice(0, 14).map((l) => l.text).join(" ");
  const hasEmail = EMAIL.test(fullText);
  const hasPhone = PHONE.test(top);
  const hasLinkedIn = LINKEDIN.test(fullText);
  const missingContact = [!hasEmail && "email", !hasPhone && "phone", !hasLinkedIn && "LinkedIn URL"].filter(Boolean) as string[];
  if (missingContact.length) {
    const severe = !hasEmail;
    const id = add(nameBox, {
      type: "ats",
      severity: severe ? "critical" : "warning",
      title: `Missing ${missingContact.join(" & ")}`,
      originalText: topLine.text,
      suggestedText: `${topLine.text}\nCity, Country · name@email.com · +00 00000 00000 · linkedin.com/in/yourname`,
      note: `ATS contact fields are filled from plain text near your name. ${severe ? "Without an email the recruiter literally cannot reply." : "Recruiters check LinkedIn on almost every shortlist — make it one click away."}`,
    });
    atsPenalty += (!hasEmail ? 12 : 0) + (!hasPhone ? 5 : 0) + (!hasLinkedIn ? 3 : 0);
    checks.push({ id: "contact", label: "Contact details", status: severe ? "fail" : "warn", detail: `Missing: ${missingContact.join(", ")}.` });
    fixes.push({ id: "f-contact", priority: severe ? "high" : "low", title: `Add ${missingContact.join(" & ")} to the header`, detail: "Plain text, not icons or images.", annotationIds: [id], impact: severe ? 8 : 2 });
  } else {
    checks.push({ id: "contact", label: "Contact details", status: "pass", detail: "Email, phone and LinkedIn found." });
  }

  // Standard sections
  const required: SectionKey[] = ["experience", "education", "skills"];
  const missingSections = required.filter((k) => !found.has(k));
  if (missingSections.length) {
    const labels = missingSections.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    const id = add(nameBox, {
      type: "ats",
      severity: missingSections.includes("experience") ? "critical" : "warning",
      title: `No “${labels.join("”, “")}” heading`,
      originalText: topLine.text,
      suggestedText: `Add standard headings: ${labels.map((l) => l.toUpperCase()).join(", ")}`,
      note: "ATS parsers map your content into fields using conventional headings. Creative headings (“Where I’ve Been”) or missing ones leave fields empty in the recruiter’s view.",
    });
    atsPenalty += missingSections.length * 9;
    checks.push({ id: "sections", label: "Standard section headings", status: missingSections.includes("experience") ? "fail" : "warn", detail: `Missing: ${labels.join(", ")}.` });
    fixes.push({ id: "f-sections", priority: "high", title: `Add a ${labels.join(" / ")} section`, detail: "Use the exact conventional heading.", annotationIds: [id], impact: missingSections.length * 4 });
  } else {
    checks.push({ id: "sections", label: "Standard section headings", status: "pass", detail: "Experience, Education and Skills detected." });
  }

  // Length
  if (resume.pageCount > 2) {
    atsPenalty += 5;
    checks.push({ id: "length", label: "Length (1–2 pages)", status: "warn", detail: `${resume.pageCount} pages — trim to 2 max.` });
  } else if (words < 220) {
    atsPenalty += 8;
    checks.push({ id: "length", label: "Length (1–2 pages)", status: "warn", detail: `Only ${words} words — too thin to rank on keywords.` });
  } else {
    checks.push({ id: "length", label: "Length (1–2 pages)", status: "pass", detail: `${resume.pageCount} page${resume.pageCount > 1 ? "s" : ""}, ${words} words.` });
  }

  // Keywords
  checks.push({
    id: "keywords",
    label: kw.source === "job-description" ? "Job-description keywords" : `${FAMILY_LABEL[family]} keywords`,
    status: kw.score >= 70 ? "pass" : kw.score >= 40 ? "warn" : "fail",
    detail: `${kw.matched.length} of ${kw.matched.length + kw.missing.length}${kw.missing.length >= 12 ? "+" : ""} expected terms found.`,
  });
  checks.push({ id: "file", label: "File type & size", status: "pass", detail: "PDF under 5 MB." });

  const skillsHeader = headers.find((h) => h.key === "skills");
  if (kw.score < 70 && kw.missing.length) {
    const ids = skillsHeader
      ? [
          add(unionBox([skillsHeader.line]), {
            type: "ats",
            severity: kw.score < 40 ? "critical" : "warning",
            title: "Missing role keywords",
            originalText: skillsHeader.line.text,
            suggestedText: `Add (only if true): ${kw.missing.slice(0, 6).join(", ")}`,
            note: `Recruiters search the ATS by keyword. For ${kw.source === "job-description" ? "this job description" : FAMILY_LABEL[family]} roles you're missing ${kw.missing.length} common terms — work the ones you genuinely have into Skills and your bullets.`,
          }),
        ]
      : [];
    fixes.push({ id: "f-keywords", priority: kw.score < 40 ? "high" : "medium", title: `Work in missing keywords: ${kw.missing.slice(0, 4).join(", ")}`, detail: "Use exact phrasing from the job post.", annotationIds: ids, impact: Math.round((70 - kw.score) / 6) + 2 });
  }

  /* ---------- content fixes ---------- */
  const bulletTotal = contentBlocks.filter((b) => wordCount(stripBullet(b.text)) >= 4).length;
  if (weakIds.length) fixes.push({ id: "f-weak", priority: "high", title: `Rewrite ${weak} passive bullet${weak > 1 ? "s" : ""} with action verbs`, detail: "Lead with Led / Built / Cut / Grew.", annotationIds: weakIds, impact: Math.min(10, weak * 2 + 2) });
  const unquantified = bulletTotal - quantified;
  if (unquantified > 0) fixes.push({ id: "f-metrics", priority: "high", title: `Add a metric to ${unquantified} bullet${unquantified > 1 ? "s" : ""}`, detail: "Aim for 60%+ of bullets with a number.", annotationIds: noMetricIds, impact: Math.min(14, Math.round(unquantified * 1.4)) });
  if (cliches) fixes.push({ id: "f-cliche", priority: "low", title: "Swap buzzwords for evidence", detail: `${cliches} generic phrase(s) found.`, annotationIds: annotations.filter((a) => a.title === "Generic buzzword").map((a) => a.id), impact: 2 });

  /* ---------- scores ---------- */
  const qRatio = bulletTotal ? quantified / bulletTotal : 0;
  const sRatio = bulletTotal ? strong / bulletTotal : 0;
  const wRatio = bulletTotal ? weak / bulletTotal : 0;
  const impact = bulletTotal
    ? clamp(Math.round(24 + 48 * qRatio + 26 * sRatio - 22 * wRatio - 3 * cliches), 8, 98)
    : 32;
  const ats = clamp(Math.round(100 - atsPenalty), 5, 99);
  const formatting = clamp(Math.round(100 - formatPenalty), 5, 100);

  return finalize({
    resume,
    opts,
    annotations,
    fixes,
    checks,
    sections: (["summary", "experience", "education", "skills", "projects", "certifications"] as SectionKey[]).map((k) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      found: found.has(k),
    })),
    scores: { ats, impact, keywords: kw.score, formatting },
    bulletStats: { total: bulletTotal, quantified, strong, weak },
    keywordInfo: { ...kw, family },
    warnings,
    t0,
    summary: buildSummary({ ats, impact, kw: kw.score, qRatio, weak, unquantified, layoutIssue: runs.length > 0, missingSections }),
  });
}

function buildSummary(s: { ats: number; impact: number; kw: number; qRatio: number; weak: number; unquantified: number; layoutIssue: boolean; missingSections: string[] }) {
  const parts: string[] = [];
  if (s.ats >= 80 && s.impact >= 75) parts.push("A strong, parser-friendly resume.");
  else if (s.ats >= 80) parts.push("Parses cleanly, but the content undersells you.");
  else if (s.impact >= 75) parts.push("Compelling content held back by parser risks.");
  else parts.push("Solid raw material that needs a structural and content pass.");
  const lifts: string[] = [];
  if (s.layoutIssue) lifts.push("flatten the side-by-side columns");
  if (s.missingSections.length) lifts.push(`add a ${s.missingSections.join("/")} heading`);
  if (s.weak) lifts.push(`rewrite ${s.weak} passive bullet${s.weak > 1 ? "s" : ""}`);
  if (s.unquantified > 0) lifts.push(`quantify ${s.unquantified} more bullet${s.unquantified > 1 ? "s" : ""} (only ${Math.round(s.qRatio * 100)}% have a number)`);
  if (s.kw < 60) lifts.push("work in missing role keywords");
  if (lifts.length) parts.push(`Biggest lifts: ${lifts.slice(0, 3).join(", ")}.`);
  return parts.join(" ");
}

function finalize(input: {
  resume: ExtractedResume;
  opts: AnalyzeOptions;
  annotations: Annotation[];
  fixes: Fix[];
  checks: AtsCheck[];
  sections: { name: string; found: boolean }[];
  scores: ResumeAnalysis["scores"];
  bulletStats: { total: number; quantified: number; strong: number; weak: number };
  keywordInfo: { matched: string[]; missing: string[]; source: "job-description" | "role-profile"; density: number; family: RoleFamily };
  warnings: string[];
  t0: number;
  summary: string;
}): ResumeAnalysis {
  const { scores, bulletStats: b, keywordInfo: kw } = input;
  const overall = clamp(Math.round(scores.ats * 0.4 + scores.impact * 0.4 + scores.keywords * 0.2), 0, 100);
  const order = { critical: 0, warning: 1, positive: 2 };
  const annotations = [...input.annotations].sort((a, z) => a.page - z.page || a.y - z.y || order[a.severity] - order[z.severity]);
  const words = wordCount(input.resume.lines.map((l) => l.text).join(" "));
  return {
    overallScore: overall,
    scores,
    metrics: {
      quantifiedImpactPct: b.total ? Math.round((b.quantified / b.total) * 100) : 0,
      formattingRisk: scores.formatting >= 85 ? "low" : scores.formatting >= 68 ? "medium" : "high",
      keywordDensityPct: kw.density,
      wordCount: words,
      bulletCount: b.total,
      quantifiedBullets: b.quantified,
      strongVerbBullets: b.strong,
      weakVerbBullets: b.weak,
      pageCount: input.resume.pageCount,
    },
    keywords: { matched: kw.matched, missing: kw.missing, source: kw.source, family: FAMILY_LABEL[kw.family] },
    checks: input.checks,
    sections: input.sections,
    annotations,
    fixes: [...input.fixes].sort((a, z) => z.impact - a.impact),
    summary: input.summary,
    detectedRole: input.opts.targetRole || FAMILY_LABEL[kw.family],
    meta: { engine: "heuristic", warnings: input.warnings, ms: Date.now() - input.t0 },
  };
}

/** Lines + statement blocks, numbered for the LLM prompt. */
export function blocksForPrompt(resume: ExtractedResume) {
  const { blocks } = buildBlocks(resume.lines);
  return blocks.map((b) => ({ id: b.id, section: b.section, text: stripBullet(b.text), box: unionBox(b.lines) }));
}
