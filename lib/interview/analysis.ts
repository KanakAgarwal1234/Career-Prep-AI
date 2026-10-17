/**
 * Shared answer analysis used by both the adaptive planner (to decide on
 * follow-ups) and the scorer. Pure functions — safe on server and client.
 */
import { FAMILY_KEYWORDS, FILLERS, HEDGES, TOOL_VOCAB, countTerm, escapeRe, type RoleFamily } from "@/lib/resume/lexicon";

const STOP = new Set(
  "a an the and or but if then so to of in on for with at by from as is are was were be been being it its this that these those i me my we our you your they their he she them his her what which who whom how why when where do does did done have has had can could would should will shall may might must about into over under after before more most very just also than not no yes there here up out".split(" "),
);

export const STAR_RE = {
  situation: /\b(when i was|at (my )?(previous|last|current|old) (job|company|role|team)|we were|the (situation|context|problem|challenge|issue) was|our team|last (year|quarter|month)|in (my|our) (role|team|company)|i was working|back in|there was a|at [A-Z][a-z]+)/i,
  task: /\b(my (goal|task|job|role|responsibility|mandate) was|i (needed|had|wanted) to|i was (asked|tasked|responsible|hired)|the goal was|we needed to|objective was|i owned|my target)/i,
  action: /\bi (built|led|created|designed|analy[sz]ed|wrote|implemented|decided|organi[sz]ed|proposed|set up|ran|talked|met|reached out|negotiated|prioriti[sz]ed|launched|tested|reviewed|introduced|started|changed|worked with|partnered|convinced|presented|coached|automated|reduced|identified|mapped|interviewed|drafted|escalated|pushed|aligned|broke|scoped|shipped|hired|trained|rewrote|investigated|dug|pulled|asked|suggested|recommended)\b/i,
  result: /(as a result|result(ed)? in|which (led|meant|helped|allowed)|the outcome|ended up|increased|decreased|reduced|improved|grew|saved|cut|we (hit|achieved|delivered|shipped|launched|closed)|learned|lesson|impact|\d+\s?(%|percent)|\$\s?\d|\d+\s?(x|times))/i,
};

const TECH_STRUCTURE = /\b(first|second|then|next|finally|trade-?offs?|because|depends|assum(e|ption)|constraint|alternative|instead|bottleneck|measure|metric|validate|hypothes[ie]s|edge case|scale|monitor)\b/gi;

export const wordsOf = (s: string) => s.toLowerCase().match(/[a-z0-9][a-z0-9'%$.-]*/g) || [];

export function contentWords(s: string) {
  return wordsOf(s).filter((w) => w.length > 2 && !STOP.has(w));
}

export function countFillers(text: string) {
  const lower = ` ${text.toLowerCase()} `;
  const out: Record<string, number> = {};
  for (const f of FILLERS) {
    let n = 0;
    if (f === "like") {
      // only count "like" used as filler, not as a verb/preposition
      const all = lower.match(/\blike\b/g)?.length || 0;
      const legit = lower.match(/\b(would|i|we|you|they|don't|didn't|looks?|looked|feels?|felt|seems?|something|things?|just|more|much|exactly|is|was) like\b/g)?.length || 0;
      n = Math.max(0, all - legit);
    } else if (f === "actually" || f === "basically" || f === "literally") {
      n = countTerm(lower, f);
      if (n <= 1) n = 0; // a single use is natural
    } else {
      n = (lower.match(new RegExp(`\\b${escapeRe(f)}\\b`, "g")) || []).length;
    }
    if (n) out[f] = n;
  }
  return out;
}

export function countHedges(text: string) {
  const lower = text.toLowerCase();
  return HEDGES.reduce((s, h) => s + (lower.match(new RegExp(`\\b${escapeRe(h)}\\b`, "g")) || []).length, 0);
}

export interface AnswerSignals {
  words: number;
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  numbers: string[];
  domainTerms: string[];
  iCount: number;
  weCount: number;
  relevance: number; // 0..1
  structureMarkers: number;
  hasMetric: boolean;
}

export function analyzeAnswer(question: string, answer: string, family: RoleFamily): AnswerSignals {
  const words = wordsOf(answer).length;
  const numbers = answer.match(/(?<![A-Za-z\d])\$?\d[\d,.]*(?:\s?(?:%|percent|k|m|x|million|thousand|hours|days|weeks|months|users|customers|people))?(?![A-Za-z\d])/gi) || [];
  const vocab = Array.from(new Set([...FAMILY_KEYWORDS[family], ...TOOL_VOCAB]));
  const domainTerms = vocab.filter((t) => countTerm(answer, t) > 0);
  const qWords = new Set(contentWords(question));
  const aWords = new Set(contentWords(answer));
  const overlap = [...qWords].filter((w) => aWords.has(w)).length;
  const relevance = qWords.size ? Math.min(1, overlap / Math.max(3, qWords.size * 0.45)) : 0.5;
  return {
    words,
    star: {
      situation: STAR_RE.situation.test(answer),
      task: STAR_RE.task.test(answer),
      action: STAR_RE.action.test(answer),
      result: STAR_RE.result.test(answer),
    },
    numbers: numbers.map((n) => n.trim()),
    domainTerms,
    iCount: (answer.match(/\b(i|i'm|i've|i'd|my|me|myself)\b/gi) || []).length,
    weCount: (answer.match(/\bwe\b|\bour\b|\bus\b/gi) || []).length,
    relevance,
    structureMarkers: (answer.match(TECH_STRUCTURE) || []).length,
    hasMetric: numbers.length > 0 || /\b(doubled|tripled|halved|percent)\b/i.test(answer),
  };
}

/** First key number in a claim, e.g. "34%" or "$310K". */
export function claimNumber(claim: string) {
  return claim.match(/\$?\d[\d,.]*\s?(%|k|m|x|\+)?/i)?.[0]?.trim();
}

export function normalizeNumber(n: string) {
  return n.replace(/[,\s]/g, "").replace(/percent/i, "%").toLowerCase();
}

const unitOf = (n: string) => (/%|percent/i.test(n) ? "%" : /\$/.test(n) ? "$" : "n");

/** A resume claim's headline number vs. what the candidate said, compared like-for-like (%, $, plain). */
export function numberConflict(claim: string, spoken: string[]) {
  const claimed = claimNumber(claim);
  if (!claimed) return null;
  const unit = unitOf(claimed);
  const comparable = spoken.filter((n) => unitOf(n) === unit && unit !== "n");
  if (!comparable.length) return null;
  const target = normalizeNumber(claimed).replace(/[+]/g, "");
  return comparable.some((n) => normalizeNumber(n).includes(target)) ? null : { claimed, said: comparable[0] };
}
