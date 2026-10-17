/* ------------------------------------------------------------------ */
/* Part 1 — Visual ATS audit                                           */
/* ------------------------------------------------------------------ */

export type AnnotationType = "ats" | "impact" | "format";
export type Severity = "critical" | "warning" | "positive";

/** One visual line of text, with its box normalised to the page (0–1). */
export interface ResumeLine {
  id: string; // "p1-l12"
  page: number; // 1-based
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number; // in PDF points
  /** Horizontally separated runs on the same baseline (e.g. two columns, or title + right-aligned date). */
  segments: { x: number; text: string }[];
}

export interface ExtractedResume {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: { width: number; height: number }[]; // PDF points
  lines: ResumeLine[];
}

/**
 * A coordinate-anchored callout. `x`, `y`, `width`, `height` are normalised
 * to the page box (0–1, origin top-left) so they scale with any zoom level.
 */
export interface Annotation {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: AnnotationType;
  severity: Severity;
  title: string;
  originalText: string;
  suggestedText: string;
  note: string;
}

export interface AtsCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface Fix {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  annotationIds: string[];
  /** Estimated score lift in points. */
  impact: number;
}

export interface ResumeAnalysis {
  overallScore: number;
  scores: { ats: number; impact: number; keywords: number; formatting: number };
  metrics: {
    quantifiedImpactPct: number;
    formattingRisk: "low" | "medium" | "high";
    keywordDensityPct: number;
    wordCount: number;
    bulletCount: number;
    quantifiedBullets: number;
    strongVerbBullets: number;
    weakVerbBullets: number;
    pageCount: number;
  };
  keywords: { matched: string[]; missing: string[]; source: "job-description" | "role-profile"; family: string };
  checks: AtsCheck[];
  sections: { name: string; found: boolean }[];
  annotations: Annotation[];
  fixes: Fix[];
  summary: string;
  detectedRole?: string;
  meta: { engine: "llm" | "heuristic"; provider?: string; model?: string; warnings: string[]; ms: number };
}

/* ------------------------------------------------------------------ */
/* Resume context shared with the interview                            */
/* ------------------------------------------------------------------ */

export interface ResumeProfile {
  name?: string;
  headline?: string;
  titles: string[];
  companies: string[];
  skills: string[];
  /** Quantified achievement bullets — the interviewer probes these. */
  claims: string[];
  yearsExperience?: number;
  text: string;
  source: "ats-audit" | "upload" | "paste";
  fileName?: string;
}

/* ------------------------------------------------------------------ */
/* Part 2 — Mock interview                                             */
/* ------------------------------------------------------------------ */

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead";
export type Plan = "trial" | "pro";
export type QuestionType = "opener" | "behavioral" | "technical" | "situational" | "resume" | "follow-up" | "closing";

export interface InterviewSetup {
  sessionId: string;
  role: string;
  industry: string;
  level: ExperienceLevel;
  jobDescription?: string;
  resume?: ResumeProfile;
  plan: Plan;
  inputMode: "voice" | "text";
}

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  /** Competency being probed, e.g. "Ownership", "System design". */
  focus: string;
  /** Resume claim being verified, when type === "resume". */
  claim?: string;
  /** For follow-ups: the question being drilled into. */
  parentId?: string;
}

export interface DeliveryMetrics {
  words: number;
  durationSec: number;
  speakingSec: number;
  wpm: number;
  fillerCount: number;
  fillers: Record<string, number>;
  /** short 1–2s, medium 2–4s, long >4s */
  pauses: { short: number; medium: number; long: number };
  longestPauseSec: number;
  /** Seconds from end of question to first recognised word. */
  latencySec: number;
  hedgeCount: number;
  sttConfidence?: number;
}

export interface InterviewTurn {
  question: InterviewQuestion;
  answer: string;
  metrics: DeliveryMetrics;
}

export interface NextQuestionResponse {
  done: boolean;
  question?: InterviewQuestion;
  /** Short acknowledgement spoken before the next question. */
  ack?: string;
  closing?: string;
  index: number; // 0-based index of the returned question
  total: number;
  meta: { engine: "llm" | "heuristic"; plan: Plan };
}

export interface StarFramework {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface QuestionReview {
  questionId: string;
  question: string;
  type: QuestionType;
  focus: string;
  answer: string;
  score: number;
  critique: string;
  strengths: string[];
  improvements: string[];
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  idealAnswer: StarFramework;
  metrics: DeliveryMetrics;
}

export interface InterviewReport {
  id: string;
  createdAt: string;
  setup: Omit<InterviewSetup, "resume"> & { resumeName?: string; hasResume: boolean };
  scores: { overall: number; communication: number; domain: number; alignment: number; delivery: number; structure: number };
  verdict: string;
  summary: string;
  strengths: string[];
  priorities: string[];
  alignment: {
    score: number;
    supported: { claim: string; evidence: string }[];
    unsupported: string[];
    conflicts: { claim: string; note: string }[];
  };
  delivery: {
    avgWpm: number;
    paceLabel: string;
    fillerPerMin: number;
    fillerTotal: number;
    fillers: Record<string, number>;
    pauses: { short: number; medium: number; long: number };
    avgLatencySec: number;
    confidence: number;
    confidenceLabel: string;
    notes: string[];
  };
  questions: QuestionReview[];
  meta: { engine: "llm" | "heuristic"; provider?: string; model?: string; warnings: string[] };
}
