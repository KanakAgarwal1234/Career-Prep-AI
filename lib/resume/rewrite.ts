import { STRONG_VERBS, WEAK_PHRASES } from "./lexicon";

const IRREGULAR_PAST: Record<string, string> = {
  running: "Ran", leading: "Led", building: "Built", writing: "Wrote", making: "Made", setting: "Set",
  overseeing: "Oversaw", teaching: "Taught", selling: "Sold", buying: "Bought", driving: "Drove", growing: "Grew",
  bringing: "Brought", thinking: "Thought", winning: "Won", meeting: "Met", getting: "Got", taking: "Took",
  giving: "Gave", cutting: "Cut", shipping: "Shipped", planning: "Planned", spearheading: "Spearheaded",
};

/** Gerunds safe to convert inside a list ("…, running interviews, coordinating QA"). */
const ACTION_GERUNDS = new Set(
  ("working running coordinating managing writing leading building creating developing designing overseeing driving " +
    "conducting handling supporting analyzing analysing organizing organising preparing maintaining monitoring tracking " +
    "reviewing delivering implementing launching owning partnering presenting collaborating gathering defining executing " +
    "facilitating mentoring hiring negotiating improving reducing increasing streamlining automating").split(" "),
);

/** "developing" → "Developed", "managing" → "Managed" */
export function gerundToPast(word: string): string | null {
  const w = word.toLowerCase();
  if (!w.endsWith("ing") || w.length < 5) return null;
  if (IRREGULAR_PAST[w]) return IRREGULAR_PAST[w];
  const stem = w.slice(0, -3);
  // manag(e)ing → managed, stopp·ing → stopped, apply·ing → applied
  const past = /[^aeiou]y$/.test(stem) ? stem.slice(0, -1) + "ied" : stem.endsWith("e") ? stem + "d" : stem + "ed";
  return past.charAt(0).toUpperCase() + past.slice(1);
}

const IMPACT_CLAUSES: [RegExp, string][] = [
  [/\b(roadmap|launch|launched|release|releases|product|checkout|onboarding flow)\b/i, "lifting [key metric] by [X%] within [N] weeks of launch"],
  [/\b(data|analysis|reports?|reporting|dashboards?|insights|metrics|kpis?)\b/i, "eliminating [N] hours/week of manual reporting for [N] stakeholders"],
  [/\b(sales|revenue|deal|pipeline|quota|clients?|accounts?)\b/i, "generating [$X] in new revenue across [N] accounts"],
  [/\b(customer|support|tickets?|service|satisfaction|csat|nps)\b/i, "lifting CSAT from [X%] to [Y%] while cutting response time by [Z%]"],
  [/\b(process|workflow|operations|onboarding|procurement|inventory|logistics)\b/i, "cutting cycle time by [X%] and saving [N] hours per week"],
  [/\b(code|software|api|apps?|features?|systems?|platform|services?|backend|frontend|website|pipeline)\b/i, "reducing latency by [X%] for [N]+ users"],
  [/\b(marketing|campaigns?|social|content|seo|brand|newsletter|email)\b/i, "increasing engagement by [X%] and leads by [Y%]"],
  [/\b(hire|hired|hiring|mentor|mentored|mentoring|interns?|direct reports)\b/i, "growing a team of [N] and raising delivery velocity by [X%]"],
  [/\b(budget|cost|spend|vendors?|finance|financial)\b/i, "saving [$X] annually ([Y%] under budget)"],
  [/\b(design|ux|ui|research|prototype|usability)\b/i, "improving task completion by [X%] in usability testing"],
  [/\b(events?|program|training|workshops?)\b/i, "reaching [N] participants with a [X%] satisfaction score"],
];

export function impactClause(text: string) {
  for (const [re, clause] of IMPACT_CLAUSES) if (re.test(text)) return clause;
  return "delivering [measurable outcome — e.g. X% faster, $Y saved, N users]";
}

export const stripBullet = (s: string) => s.replace(/^\s*([•●▪◦‣∙·\-–—*»►▶➤➢➔→✓✔★☆◆◇■□❖]|[-])\s*/u, "").trim();

const YEAR_OR_DATE = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\b|\b\d{1,2}\/\d{2,4}\b/gi;

export function hasMetric(text: string) {
  const t = text.replace(YEAR_OR_DATE, " ");
  return /\d/.test(t) || /\b(doubled|tripled|halved|tenfold|twofold)\b/i.test(t);
}

export function firstWord(text: string) {
  return (stripBullet(text).match(/^[A-Za-z][A-Za-z-]*/)?.[0] || "").toLowerCase();
}

export function isStrongOpener(text: string) {
  return STRONG_VERBS.has(firstWord(text));
}

export function findWeakPhrase(text: string) {
  const body = stripBullet(text);
  return WEAK_PHRASES.find((w) => w.re.test(body)) || null;
}

/**
 * Template rewrite used when no LLM is configured. Placeholders in [brackets]
 * mark numbers the candidate must supply — we never invent results.
 */
export function rewriteBullet(text: string): string {
  let body = stripBullet(text).replace(/\s+/g, " ").replace(/[.;]\s*$/, "");
  const weak = findWeakPhrase(body);

  if (weak) {
    body = body.replace(weak.re, "").trim();
    const next = body.match(/^([A-Za-z]+ing)\b/);
    const past = next ? gerundToPast(next[1]) : null;
    if (past) body = `${past}${body.slice(next![1].length)}`;
    else body = `${weak.verb} ${body.replace(/^(the|a|an)\s+/i, (m) => m.toLowerCase())}`;
  } else if (!isStrongOpener(body)) {
    const next = body.match(/^([A-Za-z]+ing)\b/);
    const past = next ? gerundToPast(next[1]) : null;
    if (past) body = `${past}${body.slice(next![1].length)}`;
  }

  body = body.replace(/(,|\band) ([a-z]+ing)\b/g, (m, sep: string, g: string) => (ACTION_GERUNDS.has(g) ? `${sep} ${gerundToPast(g)!.toLowerCase()}` : m));
  body = body.replace(/\b(I|my|me)\b\s*/g, "").replace(/\s{2,}/g, " ").trim();
  body = body.charAt(0).toUpperCase() + body.slice(1);

  if (!hasMetric(body)) body = `${body}, ${impactClause(body)}`;
  return body.endsWith(".") ? body.slice(0, -1) : body;
}

export function splitLongBullet(text: string) {
  const body = stripBullet(text);
  const parts = body.split(/;|, and |\. /).map((s) => s.trim()).filter((s) => s.split(" ").length > 3);
  if (parts.length < 2) return rewriteBullet(body);
  return parts.slice(0, 2).map((p) => `• ${rewriteBullet(p)}`).join("\n");
}
