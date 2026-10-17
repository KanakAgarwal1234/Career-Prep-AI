import type { ResumeProfile } from "@/lib/types";
import { ALL_KEYWORDS, TOOL_VOCAB, termRegex } from "./lexicon";
import { hasMetric, isStrongOpener, stripBullet } from "./rewrite";

const TITLE_RE =
  /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|director|vp|chief|associate|assistant)?\s*(software|data|product|marketing|sales|growth|operations|financial|business|ux|ui|frontend|backend|full[- ]?stack|account|project|program|content|brand|hr|people|design)?\s*(engineer|developer|scientist|analyst|manager|designer|consultant|specialist|coordinator|executive|director|lead|architect|strategist|associate|intern|officer|researcher)\b/i;

const YEAR = /\b(19|20)\d{2}\b/g;

/**
 * Lightweight resume profiler: pulls the facts an interviewer would probe —
 * titles, employers, skills and quantified claims — from plain text.
 */
export function buildResumeProfile(text: string, source: ResumeProfile["source"], fileName?: string): ResumeProfile {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const name = lines.find((l) => /^[A-Z][a-zA-Z'’.-]+( [A-Z][a-zA-Z'’.-]+){1,3}$/.test(l) && l.length < 40);

  const titles: string[] = [];
  const companies: string[] = [];
  for (const l of lines.slice(0, 120)) {
    if (l.length > 90) continue;
    const m = l.match(TITLE_RE);
    if (m && m[0].trim().split(" ").length >= 1 && !/^(•|-|–)/.test(l)) {
      const title = m[0].replace(/\s+/g, " ").trim();
      if (title.length > 3 && !titles.some((t) => t.toLowerCase() === title.toLowerCase())) titles.push(title.replace(/^\w/, (c) => c.toUpperCase()));
      const company = l
        .replace(m[0], "")
        .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{4}|\b\d{1,2}\/\d{4}|\b(19|20)\d{2}|present|current/gi, "")
        .replace(/[|,–—-]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (company && company.length > 1 && company.length < 40 && /^[A-Z]/.test(company) && !companies.includes(company)) companies.push(company);
    }
  }

  const vocab = Array.from(new Set([...ALL_KEYWORDS, ...TOOL_VOCAB]));
  const skills = vocab.filter((k) => k.length > 1 && termRegex(k).test(text)).slice(0, 18);

  const claims = lines
    .map(stripBullet)
    .filter((l) => l.split(" ").length >= 6 && hasMetric(l) && !/@|linkedin|https?:|\(\d{3}\)|\+\d/i.test(l))
    .sort((a, b) => Number(isStrongOpener(b)) - Number(isStrongOpener(a)) || (b.match(/\d/g) || []).length - (a.match(/\d/g) || []).length)
    .slice(0, 6);

  // Tenure from work lines only — graduation years would inflate it.
  const workText = lines.filter((l) => !/universit|college|school|bachelor|master|\bb\.?s\.?\b|\bb\.?a\.?\b|\bm\.?s\.?\b|mba|b\.?tech|ph\.?d|degree|graduat/i.test(l)).join("\n");
  const years = (workText.match(YEAR) || []).map(Number).filter((y) => y > 1970 && y <= new Date().getFullYear() + 1);
  const hasPresent = /\b(present|current|now)\b/i.test(text);
  let yearsExperience: number | undefined;
  if (years.length >= 2) {
    const start = Math.min(...years);
    const end = hasPresent ? new Date().getFullYear() : Math.max(...years);
    yearsExperience = Math.max(0, Math.min(40, end - start));
  }

  return {
    name,
    headline: titles[0],
    titles: titles.slice(0, 5),
    companies: companies.slice(0, 5),
    skills,
    claims,
    yearsExperience,
    text: text.slice(0, 12000),
    source,
    fileName,
  };
}

export function suggestLevel(years?: number): "entry" | "mid" | "senior" | "lead" {
  if (years === undefined) return "mid";
  if (years < 2) return "entry";
  if (years < 6) return "mid";
  if (years < 11) return "senior";
  return "lead";
}
