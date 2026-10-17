/**
 * Shared lexicon for the offline engines: role families + their ATS keywords,
 * verb strength lists, fillers and hedges. Kept in one place so the resume
 * audit and the interview scorer agree on vocabulary.
 */

export type RoleFamily =
  | "software"
  | "data"
  | "product"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "people"
  | "consulting"
  | "general";

export const FAMILY_LABEL: Record<RoleFamily, string> = {
  software: "Software Engineering",
  data: "Data & Analytics",
  product: "Product Management",
  design: "Design",
  marketing: "Marketing",
  sales: "Sales & Business Development",
  finance: "Finance",
  operations: "Operations",
  people: "People & HR",
  consulting: "Consulting & Strategy",
  general: "General Professional",
};

const FAMILY_TITLE_HINTS: [RoleFamily, RegExp][] = [
  ["product", /\b(product manager|product owner|product lead|head of product|apm|group product manager)\b/i],
  ["data", /\b(data|analytics|analyst|machine learning|ml|ai engineer|scientist|bi\b|business intelligence)/i],
  ["software", /\b(software|engineer|developer|sde|swe|frontend|front-end|backend|back-end|full[- ]?stack|devops|sre|mobile|ios|android|programmer|architect)\b/i],
  ["design", /\b(designer|ux|ui|user experience|product design|visual design|researcher)\b/i],
  ["marketing", /\b(marketing|growth|brand|seo|content|social media|communications|pr\b|demand gen)/i],
  ["sales", /\b(sales|account executive|business development|bdr|sdr|account manager|partnerships|customer success)\b/i],
  ["finance", /\b(finance|financial|accountant|accounting|fp&a|investment|banking|analyst, finance|controller|audit|treasury)\b/i],
  ["operations", /\b(operations|ops|supply chain|logistics|project manager|program manager|procurement)\b/i],
  ["people", /\b(hr|human resources|recruiter|talent|people partner|people ops)\b/i],
  ["consulting", /\b(consultant|consulting|strategy|strategist)\b/i],
];

/** Hints are checked in priority order (e.g. target role, then title line, then body). */
export function detectFamily(...hints: (string | undefined)[]): RoleFamily {
  for (const hint of hints) {
    if (!hint) continue;
    for (const [family, re] of FAMILY_TITLE_HINTS) if (re.test(hint)) return family;
  }
  return "general";
}

/** Ordered roughly by how often recruiters filter on them. */
export const FAMILY_KEYWORDS: Record<RoleFamily, string[]> = {
  software: [
    "TypeScript", "JavaScript", "Python", "Java", "Go", "React", "Node.js", "SQL", "PostgreSQL", "AWS", "Docker",
    "Kubernetes", "REST", "GraphQL", "CI/CD", "microservices", "system design", "testing", "Git", "distributed systems",
    "performance", "scalability", "API", "cloud", "Terraform",
  ],
  data: [
    "SQL", "Python", "statistics", "machine learning", "A/B testing", "dashboards", "Tableau", "Power BI", "pandas",
    "data modeling", "ETL", "dbt", "Spark", "experimentation", "forecasting", "regression", "Snowflake", "BigQuery",
    "Looker", "data visualization", "stakeholder", "insights",
  ],
  product: [
    "roadmap", "product strategy", "user research", "A/B testing", "metrics", "KPIs", "stakeholder", "prioritization",
    "go-to-market", "PRD", "agile", "experimentation", "SQL", "customer discovery", "OKRs", "launch", "retention",
    "engagement", "cross-functional", "analytics",
  ],
  design: [
    "Figma", "user research", "prototyping", "design systems", "usability testing", "wireframes", "interaction design",
    "accessibility", "visual design", "information architecture", "journey mapping", "UX", "UI", "user flows",
    "design thinking", "iteration", "stakeholder",
  ],
  marketing: [
    "SEO", "SEM", "content strategy", "campaigns", "Google Analytics", "conversion", "CAC", "ROI", "email marketing",
    "social media", "brand", "paid media", "A/B testing", "HubSpot", "funnel", "lead generation", "engagement",
    "copywriting", "market research", "retention",
  ],
  sales: [
    "pipeline", "quota", "CRM", "Salesforce", "prospecting", "negotiation", "closing", "account management", "revenue",
    "forecasting", "lead generation", "B2B", "SaaS", "upsell", "churn", "customer success", "territory", "ARR",
    "discovery", "relationship",
  ],
  finance: [
    "financial modeling", "Excel", "forecasting", "budgeting", "variance analysis", "FP&A", "valuation", "DCF", "GAAP",
    "reporting", "P&L", "cash flow", "audit", "reconciliation", "SQL", "stakeholder", "KPIs", "investment", "risk",
  ],
  operations: [
    "process improvement", "supply chain", "logistics", "vendor management", "KPIs", "Lean", "Six Sigma", "SOP",
    "project management", "cost reduction", "inventory", "forecasting", "stakeholder", "cross-functional", "Excel",
    "SQL", "automation", "compliance", "budget",
  ],
  people: [
    "recruiting", "talent acquisition", "onboarding", "employee engagement", "performance management", "HRIS",
    "compensation", "benefits", "employee relations", "compliance", "DEI", "retention", "sourcing", "stakeholder",
    "learning and development", "workforce planning",
  ],
  consulting: [
    "strategy", "stakeholder", "market analysis", "financial modeling", "Excel", "PowerPoint", "due diligence",
    "client", "workshops", "recommendations", "business case", "process improvement", "change management",
    "research", "synthesis", "project management", "KPIs",
  ],
  general: [
    "stakeholder", "cross-functional", "project management", "communication", "Excel", "data analysis", "process improvement",
    "leadership", "KPIs", "budget", "strategy", "customer", "reporting", "collaboration", "problem solving",
  ],
};

export const ALL_KEYWORDS = Array.from(new Set(Object.values(FAMILY_KEYWORDS).flat()));

/** Extra tool/tech vocabulary we recognise inside job descriptions. */
export const TOOL_VOCAB = [
  "Jira", "Confluence", "Notion", "Asana", "Slack", "Excel", "Google Sheets", "Salesforce", "HubSpot", "Marketo",
  "Zendesk", "Workday", "SAP", "Oracle", "NetSuite", "QuickBooks", "Tableau", "Looker", "Power BI", "Mixpanel", "Amplitude",
  "Segment", "Figma", "Sketch", "Adobe", "Photoshop", "Illustrator", "React", "Vue", "Angular", "Next.js", "Node.js",
  "Python", "R", "Scala", "Rust", "C++", "C#", ".NET", "Ruby", "Rails", "PHP", "Swift", "Kotlin", "Flutter", "AWS", "GCP",
  "Azure", "Kafka", "Redis", "MongoDB", "MySQL", "Airflow", "Databricks", "TensorFlow", "PyTorch", "LLM", "OpenAI",
];

export const STRONG_VERBS = new Set(
  (
    "accelerated achieved acquired architected automated boosted built captured championed closed consolidated converted " +
    "created cut decreased delivered designed developed directed doubled drove eliminated engineered established exceeded " +
    "expanded generated grew halved headed implemented improved increased initiated innovated introduced launched led " +
    "lowered mentored migrated modernized negotiated optimized orchestrated overhauled pioneered produced rebuilt redesigned " +
    "reduced refactored scaled secured shipped simplified slashed spearheaded standardized streamlined tripled transformed " +
    "unified won wrote analyzed audited coached coordinated forecasted identified managed modeled owned partnered " +
    "presented resolved restructured revamped saved sourced trained instituted authored deployed integrated"
  ).split(/\s+/),
);

/** Passive / low-ownership openers → stronger replacement verb. */
export const WEAK_PHRASES: { re: RegExp; verb: string; label: string }[] = [
  { re: /^(was |were )?responsible for (managing|leading|overseeing)\b/i, verb: "Led", label: "Responsible for" },
  { re: /^(was |were )?responsible for\b/i, verb: "Owned", label: "Responsible for" },
  { re: /^duties (included|include)\b:?/i, verb: "Delivered", label: "Duties included" },
  { re: /^(was )?tasked with\b/i, verb: "Executed", label: "Tasked with" },
  { re: /^(was )?in charge of\b/i, verb: "Directed", label: "In charge of" },
  { re: /^helped (to )?(with )?/i, verb: "Drove", label: "Helped" },
  { re: /^assisted (with|in)\b/i, verb: "Supported", label: "Assisted with" },
  { re: /^assisted\b/i, verb: "Supported", label: "Assisted" },
  { re: /^worked on\b/i, verb: "Built", label: "Worked on" },
  { re: /^worked (with|closely with)\b/i, verb: "Partnered with", label: "Worked with" },
  { re: /^(was )?involved in\b/i, verb: "Delivered", label: "Involved in" },
  { re: /^participated in\b/i, verb: "Contributed to", label: "Participated in" },
  { re: /^handled\b/i, verb: "Managed", label: "Handled" },
  { re: /^did\b/i, verb: "Executed", label: "Did" },
  { re: /^tried to\b/i, verb: "Worked to", label: "Tried to" },
];

export const CLICHES = [
  "team player", "hard-working", "hardworking", "hard worker", "detail-oriented", "detail oriented", "results-driven",
  "results driven", "go-getter", "self-starter", "self starter", "think outside the box", "synergy", "dynamic individual",
  "passionate about", "proven track record", "excellent communication skills", "fast learner", "quick learner",
  "go-to person", "best of breed", "rockstar", "ninja", "guru", "out-of-the-box",
];

export const FILLERS = ["um", "uh", "erm", "uhm", "hmm", "like", "you know", "sort of", "kind of", "basically", "actually", "literally", "i mean", "so yeah"];

export const HEDGES = ["i think", "i guess", "maybe", "probably", "i'm not sure", "i am not sure", "kind of", "sort of", "i feel like", "hopefully", "i believe", "perhaps", "somewhat"];

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive whole-term matcher that tolerates symbols like "C++" / "CI/CD". */
export function termRegex(term: string, flags = "i") {
  return new RegExp(`(^|[^A-Za-z0-9+#])${escapeRe(term)}(?=$|[^A-Za-z0-9+#])`, flags);
}

export function countTerm(text: string, term: string) {
  const m = text.match(termRegex(term, "gi"));
  return m ? m.length : 0;
}
