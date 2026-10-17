import type { InterviewQuestion, InterviewSetup, InterviewTurn, NextQuestionResponse, Plan } from "@/lib/types";
import { detectFamily, type RoleFamily } from "@/lib/resume/lexicon";
import { seeded } from "@/lib/utils";
import { ACKS, BEHAVIORAL, CLOSERS, CLOSING_LINE, FOLLOW_UP_ACKS, OPENERS, SITUATIONAL, TECHNICAL, type QTemplate } from "./question-bank";
import { analyzeAnswer, numberConflict } from "./analysis";

export const QUESTION_COUNT: Record<Plan, number> = { trial: 3, pro: 7 };
const MAX_FOLLOW_UPS = 2;

export function familyFor(setup: Pick<InterviewSetup, "role" | "industry" | "jobDescription">): RoleFamily {
  return detectFamily(setup.role, setup.jobDescription?.slice(0, 400), setup.industry);
}

function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fill(t: QTemplate, setup: InterviewSetup) {
  const company = setup.resume?.companies[0];
  return t.text
    .replace(/\{role\}/g, setup.role || "this")
    .replace(/\{industry\}/g, setup.industry || "consumer")
    .replace(/\{company\}/g, company || "your last company");
}

function toQuestion(t: QTemplate, setup: InterviewSetup, extra: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return { id: t.key, text: fill(t, setup), type: t.type, focus: t.focus, ...extra };
}

function resumeQuestion(setup: InterviewSetup, rnd: () => number): InterviewQuestion | null {
  const r = setup.resume;
  if (!r) return null;
  if (r.claims.length) {
    const claim = r.claims[Math.floor(rnd() * Math.min(3, r.claims.length))];
    const short = claim.length > 150 ? `${claim.slice(0, 147).trim()}…` : claim;
    return {
      id: "rs-claim",
      type: "resume",
      focus: "Resume verification",
      claim,
      text: `Your resume says: “${short}” Walk me through how you achieved that — what was your specific role, and how did you measure the result?`,
    };
  }
  if (r.companies[0]) {
    return {
      id: "rs-company",
      type: "resume",
      focus: "Resume verification",
      text: `Tell me about your work at ${r.companies[0]}. What's the most impactful thing you delivered there, and how did you measure it?`,
    };
  }
  return null;
}

/** The ordered slot plan for a session — deterministic per sessionId. */
export function planSession(setup: InterviewSetup): InterviewQuestion[] {
  const rnd = seeded(setup.sessionId);
  const family = familyFor(setup);
  const lvl = (t: QTemplate) => !t.levels || t.levels.includes(setup.level);
  const opener = toQuestion(shuffle(OPENERS, rnd)[0], setup);
  const behavioral = shuffle(BEHAVIORAL.filter(lvl), rnd).map((t) => toQuestion(t, setup));
  const situational = shuffle(SITUATIONAL.filter(lvl), rnd).map((t) => toQuestion(t, setup));
  const technical = shuffle(TECHNICAL[family].filter(lvl), rnd).map((t) => toQuestion(t, setup));
  const closer = toQuestion(shuffle(CLOSERS, rnd)[0], setup);
  const resume = resumeQuestion(setup, rnd);

  if (setup.plan === "trial") {
    return [opener, resume || behavioral[0], technical[0]];
  }
  return [opener, resume || behavioral[1], behavioral[0], technical[0], situational[0], technical[1] || behavioral[2], closer];
}

/** Decides whether the last answer deserves a drill-down, and phrases it. */
export function followUpFor(turn: InterviewTurn, setup: InterviewSetup): InterviewQuestion | null {
  const { question, answer } = turn;
  if (question.type === "opener" || question.type === "closing" || question.type === "follow-up") return null;
  const family = familyFor(setup);
  const s = analyzeAnswer(question.text, answer, family);
  const base = { type: "follow-up" as const, parentId: question.id };

  if (question.type === "resume" && question.claim) {
    const conflict = numberConflict(question.claim, s.numbers);
    if (conflict) {
      return { ...base, id: `fu-${question.id}-num`, focus: "Consistency", text: `Your resume says ${conflict.claimed}, but you mentioned ${conflict.said}. Can you reconcile those numbers for me?` };
    }
  }
  if (s.words < 45) {
    return { ...base, id: `fu-${question.id}-depth`, focus: "Depth", text: "Can you go deeper on that? Walk me through one specific example, step by step — what you did and what happened." };
  }
  if (s.weCount >= 4 && s.weCount > s.iCount * 1.5) {
    return { ...base, id: `fu-${question.id}-own`, focus: "Ownership", text: "You said “we” quite a bit there. What specifically did you personally do, and what decisions were yours?" };
  }
  if ((question.type === "behavioral" || question.type === "resume") && !s.hasMetric && !s.star.result) {
    return { ...base, id: `fu-${question.id}-result`, focus: "Results orientation", text: "What was the measurable outcome? How did you know it actually worked?" };
  }
  if (question.type === "technical" && s.structureMarkers < 2) {
    return { ...base, id: `fu-${question.id}-tradeoff`, focus: "Depth of reasoning", text: "What trade-offs did you weigh there, and why did you choose that approach over the alternatives?" };
  }
  return null;
}

/** Offline adaptive interviewer: planned slots + up to two drill-down follow-ups (Pro only). */
export function nextQuestionOffline(setup: InterviewSetup, history: InterviewTurn[], plan: Plan): NextQuestionResponse {
  const total = QUESTION_COUNT[plan];
  const index = history.length;
  const rnd = seeded(`${setup.sessionId}:${index}`);
  const meta = { engine: "heuristic" as const, plan };

  if (index >= total) return { done: true, closing: CLOSING_LINE, index, total, meta };

  const slots = planSession({ ...setup, plan });
  const askedIds = new Set(history.map((t) => t.question.id));
  const followUps = history.filter((t) => t.question.type === "follow-up").length;
  const last = history[history.length - 1];
  const remainingAfterThis = total - index - 1;

  // Pro: adaptive drill-down, never displacing the closing question.
  if (plan === "pro" && last && followUps < MAX_FOLLOW_UPS && remainingAfterThis >= 1) {
    const fu = followUpFor(last, setup);
    if (fu) return { done: false, question: fu, ack: FOLLOW_UP_ACKS[Math.floor(rnd() * FOLLOW_UP_ACKS.length)], index, total, meta };
  }

  let question: InterviewQuestion | undefined;
  if (plan === "pro" && index === total - 1) question = slots[slots.length - 1];
  else question = slots.slice(0, plan === "pro" ? -1 : undefined).find((s) => !askedIds.has(s.id));
  question ||= slots.find((s) => !askedIds.has(s.id)) || slots[slots.length - 1];

  const ack = index === 0 ? undefined : ACKS[Math.floor(rnd() * ACKS.length)];
  return { done: false, question, ack, index, total, meta };
}

export function introLine(setup: InterviewSetup, total: number) {
  const name = setup.resume?.name?.split(" ")[0];
  return `Hi${name ? ` ${name}` : ""}, thanks for joining. I'll be interviewing you for the ${setup.role} role. We'll go through ${total} questions — take your time, and answer as you would in the real interview.`;
}
