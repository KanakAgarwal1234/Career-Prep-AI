import type { InterviewReport, InterviewSetup, InterviewTurn, QuestionReview, StarFramework } from "@/lib/types";
import { clamp, uid } from "@/lib/utils";
import { termRegex } from "@/lib/resume/lexicon";
import { analyzeAnswer, contentWords, numberConflict, type AnswerSignals } from "./analysis";
import { aggregateDelivery } from "./delivery";
import { familyFor } from "./planner";

/* ------------------------------------------------------------------ */
/* Ideal-answer frameworks                                             */
/* ------------------------------------------------------------------ */

const FOCUS_STAR: Record<string, StarFramework> = {
  "Conflict resolution": {
    situation: "Name the disagreement in one line: who, what was at stake, and why it mattered to the business.",
    task: "Your goal — not to win, but to reach the best decision while keeping the relationship intact.",
    action: "How you sought their reasoning first, brought data or a small test to depersonalise it, and agreed on a decision rule.",
    result: "The decision reached, the measurable outcome, and how the relationship changed afterwards.",
  },
  "Learning from failure": {
    situation: "Pick a real miss with stakes — the goal, the timeline and what 'success' was supposed to look like.",
    task: "What you personally owned in that outcome (avoid blaming circumstances).",
    action: "The 2–3 decisions that went wrong and what you did to recover or contain the damage.",
    result: "The concrete change you made to how you work — and evidence it worked the next time.",
  },
  "Execution under pressure": {
    situation: "The deadline, what was missing (data, people, clarity) and the cost of slipping.",
    task: "The non-negotiable outcome you had to protect.",
    action: "How you cut scope, sequenced work, made the call with partial data, and communicated risk early.",
    result: "Shipped on time? Quantify the outcome and what you'd keep doing.",
  },
  "Influence without authority": {
    situation: "The decision you wanted changed and who owned it.",
    task: "Why it mattered enough for you to push.",
    action: "How you built the case — data, a pilot, allies — and framed it in their incentives.",
    result: "The decision that changed and its measurable effect.",
  },
  Leadership: {
    situation: "The state of the team or project — symptoms with numbers (missed dates, attrition, quality).",
    task: "The turnaround target and timeframe you committed to.",
    action: "The first three changes you made (people, process, priorities) and why in that order.",
    result: "Before/after metrics and what the team could do afterwards that it couldn't before.",
  },
};

function idealFor(q: InterviewTurn["question"], setup: InterviewSetup): StarFramework {
  if (q.type === "resume" && q.claim) {
    const company = setup.resume?.companies[0];
    return {
      situation: `Set context for “${q.claim.slice(0, 90)}${q.claim.length > 90 ? "…" : ""}” — the problem${company ? ` at ${company}` : ""} and why it mattered.`,
      task: "State the specific goal and the metric you personally owned.",
      action: "Three concrete actions you took — how you found the insight, who you aligned, what you shipped.",
      result: "Restate the number from your resume, the timeframe, and what it unlocked next. Keep it consistent with the page.",
    };
  }
  if (q.type === "technical") {
    return {
      situation: "Clarify the problem and constraints out loud (scale, users, SLAs, data available).",
      task: "Define what a good answer optimises for — and what you'd trade away.",
      action: "Walk through your approach step by step, naming at least two alternatives and why you chose yours.",
      result: "Close with how you'd validate it, the metric you'd monitor, and the first risk you'd de-risk.",
    };
  }
  if (q.type === "situational") {
    return {
      situation: "Restate the scenario and what's at stake in one sentence.",
      task: "Name the decision you need to make and the criteria you'll judge it by.",
      action: "Your sequenced plan: gather facts, align the right people, decide, communicate.",
      result: "The outcome you'd expect, how you'd measure it, and when you'd course-correct.",
    };
  }
  if (q.type === "opener" || q.type === "closing") {
    return {
      situation: "Present: your current role and the one thing you're known for.",
      task: "Past: two proof points with numbers that build toward this role.",
      action: `Future: why ${setup.role} — tie your strengths to what this team needs.`,
      result: "Land it in under 90 seconds and end on a hook the interviewer can ask about.",
    };
  }
  return (
    FOCUS_STAR[q.focus] || {
      situation: "One or two sentences of context: where you were, the challenge, the stakes.",
      task: "Your specific responsibility or goal — make your role unmistakable.",
      action: "The 2–3 key actions you personally took, using “I”, with the reasoning behind each.",
      result: "A quantified outcome (%, $, time) plus what you learned or would repeat.",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Per-question scoring                                                */
/* ------------------------------------------------------------------ */

function scoreAnswer(turn: InterviewTurn, s: AnswerSignals) {
  const t = turn.question.type;
  if (s.words < 5) return 8;
  let score = 32;
  const starCount = Object.values(s.star).filter(Boolean).length;
  if (t === "technical") {
    score += Math.min(22, s.structureMarkers * 4);
    score += Math.min(16, s.domainTerms.length * 4);
  } else if (t === "opener" || t === "closing") {
    score += s.star.situation ? 6 : 0;
    score += s.hasMetric ? 10 : 0;
    score += Math.min(10, s.domainTerms.length * 3);
    score += s.relevance * 10;
  } else {
    score += starCount * 8;
    score += s.hasMetric ? 6 : 0;
  }
  score += s.words >= 90 && s.words <= 280 ? 14 : s.words >= 50 ? 7 : s.words > 380 ? 4 : -6;
  score += s.iCount >= s.weCount ? 5 : 0;
  score += Math.round(s.relevance * 8);
  return clamp(Math.round(score), 10, 96);
}

function critiqueFor(turn: InterviewTurn, s: AnswerSignals) {
  const t = turn.question.type;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (s.words >= 90 && s.words <= 280) strengths.push("Well-paced length — enough detail without rambling.");
  if (s.hasMetric) strengths.push(`Backed the story with numbers (${s.numbers.slice(0, 2).join(", ")}).`);
  if (s.star.action) strengths.push("Clear personal actions described in the first person.");
  if (t === "technical" && s.structureMarkers >= 3) strengths.push("Structured reasoning — you walked through steps and trade-offs.");
  if (s.domainTerms.length >= 2) strengths.push(`Used domain language naturally (${s.domainTerms.slice(0, 3).join(", ")}).`);

  if (s.words < 50) improvements.push("Too brief — aim for 60–120 seconds with one concrete example.");
  if (s.words > 380) improvements.push("Ran long — lead with the headline result, then add supporting detail only if asked.");
  if (t !== "technical" && t !== "opener" && t !== "closing") {
    if (!s.star.situation) improvements.push("Open with one sentence of context so the stakes are clear.");
    if (!s.star.action) improvements.push("Spell out what *you* did — specific actions, not the team's.");
    if (!s.star.result) improvements.push("End with the outcome — quantify it (%, $, time saved).");
  }
  if (t === "technical" && s.structureMarkers < 2) improvements.push("Think out loud: state assumptions, name alternatives and explain the trade-off you chose.");
  if (s.weCount >= 4 && s.weCount > s.iCount * 1.5) improvements.push(`Heavy on “we” (${s.weCount}×) — interviewers need to isolate your contribution.`);
  if (!s.hasMetric && t !== "situational") improvements.push("No numbers at all — add one metric to make the impact concrete.");
  if (s.relevance < 0.3) improvements.push("Drifted from the question — restate it in your first sentence to stay on target.");

  const lead =
    s.words < 5
      ? "No answer was captured for this question."
      : improvements.length === 0
        ? "Strong, well-structured answer that hits what interviewers listen for."
        : strengths.length
          ? `${strengths[0].replace(/\.$/, "")}, but ${improvements[0].charAt(0).toLowerCase()}${improvements[0].slice(1)}`
          : improvements[0];
  return { critique: lead, strengths: strengths.slice(0, 3), improvements: improvements.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Resume alignment                                                    */
/* ------------------------------------------------------------------ */

/** Words too common in resumes to count as evidence a specific claim was discussed. */
const GENERIC = new Set(
  "product products manager managers management support team teams users customers customer company business across using worked working project projects results result value growth through annually monthly weekly delivered".split(" "),
);

function alignment(setup: InterviewSetup, turns: InterviewTurn[]): InterviewReport["alignment"] {
  const r = setup.resume;
  if (!r || (!r.claims.length && !r.skills.length)) return { score: 0, supported: [], unsupported: [], conflicts: [] };
  const all = turns.map((t) => t.answer).join(" \n ");
  const supported: { claim: string; evidence: string }[] = [];
  const unsupported: string[] = [];
  const conflicts: { claim: string; note: string }[] = [];

  for (const claim of r.claims.slice(0, 4)) {
    const keys = contentWords(claim).filter((w) => w.length > 4 && !/^\d/.test(w) && !GENERIC.has(w)).slice(0, 8);
    const hits = keys.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(all));
    const num = claim.match(/\d[\d,.]*\s?%?/)?.[0]?.trim();
    const numberHit = num && num.length > 1 ? new RegExp(`(^|[^\\d])${num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\s/g, "\\s?")}`).test(all) : false;
    if ((numberHit && hits.length >= 1) || hits.length >= 3) {
      const sentence = all.split(/(?<=[.!?])\s+/).find((s) => (num && s.includes(num)) || hits.some((h) => s.toLowerCase().includes(h))) || "";
      supported.push({ claim, evidence: sentence.trim().slice(0, 180) || `Referenced ${hits.slice(0, 3).join(", ")}` });
    } else unsupported.push(claim);
  }
  for (const t of turns) {
    if (t.question.type === "resume" && t.question.claim) {
      const s = analyzeAnswer(t.question.text, t.answer, familyFor(setup));
      const c = numberConflict(t.question.claim, s.numbers);
      if (c) conflicts.push({ claim: t.question.claim, note: `Resume states ${c.claimed}; in the interview you said ${c.said}. Interviewers notice — keep the figures identical.` });
    }
  }
  const skillHits = r.skills.filter((sk) => termRegex(sk).test(all));
  const claimRatio = r.claims.length ? supported.length / Math.min(4, r.claims.length) : 0.5;
  const skillRatio = r.skills.length ? Math.min(1, skillHits.length / Math.min(5, r.skills.length)) : 0.5;
  const score = clamp(Math.round(30 + claimRatio * 45 + skillRatio * 25 - conflicts.length * 15));
  return { score, supported, unsupported, conflicts };
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

export function evaluateInterviewHeuristic(setup: InterviewSetup, turns: InterviewTurn[]): InterviewReport {
  const family = familyFor(setup);
  const voice = setup.inputMode === "voice" && turns.some((t) => t.metrics.speakingSec > 0);

  const questions: QuestionReview[] = turns.map((turn) => {
    const s = analyzeAnswer(turn.question.text, turn.answer, family);
    const c = critiqueFor(turn, s);
    return {
      questionId: turn.question.id,
      question: turn.question.text,
      type: turn.question.type,
      focus: turn.question.focus,
      answer: turn.answer,
      score: scoreAnswer(turn, s),
      critique: c.critique,
      strengths: c.strengths,
      improvements: c.improvements,
      star: s.star,
      idealAnswer: idealFor(turn.question, setup),
      metrics: turn.metrics,
    };
  });

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const signals = turns.map((t) => analyzeAnswer(t.question.text, t.answer, family));
  const delivery = aggregateDelivery(turns, voice);

  const storyQs = questions.filter((q) => q.type === "behavioral" || q.type === "resume" || q.type === "situational" || q.type === "follow-up");
  const structure = Math.round(storyQs.length ? avg(storyQs.map((q) => (Object.values(q.star).filter(Boolean).length / 4) * 100)) : avg(questions.map((q) => q.score)));
  const domainQs = questions.filter((q) => q.type === "technical" || q.type === "resume");
  const domainBase = avg((domainQs.length ? domainQs : questions).map((q) => q.score));
  const termCoverage = Math.min(1, new Set(signals.flatMap((s) => s.domainTerms)).size / 6);
  const domain = clamp(Math.round(domainBase * 0.8 + termCoverage * 20));
  const clarity = avg(signals.map((s) => (s.words >= 60 && s.words <= 300 ? 85 : s.words >= 35 ? 65 : 35) + (s.relevance > 0.4 ? 10 : 0)));
  const communication = clamp(Math.round(clarity * 0.5 + delivery.score * 0.3 + structure * 0.2));
  const align = alignment(setup, turns);
  const hasResume = Boolean(setup.resume && (setup.resume.claims.length || setup.resume.skills.length));
  const overall = clamp(
    Math.round(hasResume ? domain * 0.35 + communication * 0.3 + structure * 0.2 + align.score * 0.15 : domain * 0.4 + communication * 0.35 + structure * 0.25),
  );

  const verdict = overall >= 80 ? "Interview-ready" : overall >= 65 ? "Nearly there" : overall >= 50 ? "Needs practice" : "Not ready yet";
  const best = [...questions].sort((a, b) => b.score - a.score)[0];
  const worst = [...questions].sort((a, b) => a.score - b.score)[0];

  const strengths = Array.from(new Set(questions.flatMap((q) => q.strengths.map((x) => x.replace(/\s*\([^)]*\)/, ""))))).slice(0, 3);
  const priorities: string[] = [];
  if (structure < 60) priorities.push("Structure every story as Situation → Task → Action → Result; your answers most often skip the result.");
  if (!signals.some((s) => s.hasMetric) || signals.filter((s) => s.hasMetric).length < turns.length / 2)
    priorities.push("Quantify outcomes — fewer than half your answers contained a single number.");
  if (delivery.fillerPerMin > 3) priorities.push(`Cut filler words (${delivery.fillerPerMin}/min) — pause silently instead.`);
  if (voice && delivery.avgWpm > 170) priorities.push(`Slow down: ${delivery.avgWpm} WPM makes key results easy to miss.`);
  if (align.conflicts.length) priorities.push("Keep numbers identical to your resume — a mismatch was detected.");
  if (domain < 60) priorities.push(`Go deeper on ${family === "general" ? "role" : family}-specific reasoning: name trade-offs, tools and metrics.`);
  if (priorities.length < 3 && worst) priorities.push(`Re-practise “${worst.question.slice(0, 60)}…” — your lowest-scoring answer.`);

  const close = overall >= 65 ? "You're close — tighten structure and quantify every result." : "Focus on concrete examples with measurable outcomes before your next round.";
  const summary =
    turns.length === 0
      ? "No answers were captured."
      : best.score - worst.score < 5
        ? `Consistent across answers (~${Math.round(avg(questions.map((q) => q.score)))}/100). ${close}`
        : `Strongest moment: “${best.focus}” (${best.score}/100). Biggest gap: “${worst.focus}” (${worst.score}/100). ${close}`;

  return {
    id: uid("rpt"),
    createdAt: new Date().toISOString(),
    setup: {
      sessionId: setup.sessionId,
      role: setup.role,
      industry: setup.industry,
      level: setup.level,
      jobDescription: setup.jobDescription,
      plan: setup.plan,
      inputMode: setup.inputMode,
      resumeName: setup.resume?.fileName || setup.resume?.name,
      hasResume,
    },
    scores: { overall, communication, domain, alignment: align.score, delivery: delivery.score, structure },
    verdict,
    summary,
    strengths: strengths.length ? strengths : ["You completed the full interview — the hardest part of practising."],
    priorities: priorities.slice(0, 3),
    alignment: align,
    delivery: {
      avgWpm: delivery.avgWpm,
      paceLabel: delivery.paceLabel,
      fillerPerMin: delivery.fillerPerMin,
      fillerTotal: delivery.fillerTotal,
      fillers: delivery.fillers,
      pauses: delivery.pauses,
      avgLatencySec: delivery.avgLatencySec,
      confidence: delivery.confidence,
      confidenceLabel: delivery.confidenceLabel,
      notes: delivery.notes,
    },
    questions,
    meta: { engine: "heuristic", warnings: [] },
  };
}
