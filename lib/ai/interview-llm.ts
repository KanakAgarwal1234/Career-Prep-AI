import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { InterviewReport, InterviewSetup, InterviewTurn, NextQuestionResponse, Plan, QuestionType } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { CLOSING_LINE } from "@/lib/interview/question-bank";
import { getModel, llmTimeout } from "./provider";

function context(setup: InterviewSetup) {
  const r = setup.resume;
  return [
    `Role: ${setup.role} | Industry: ${setup.industry || "n/a"} | Level: ${setup.level}`,
    setup.jobDescription ? `Job description (truncated): ${setup.jobDescription.slice(0, 2500)}` : "",
    r
      ? `Candidate resume — titles: ${r.titles.join(", ") || "n/a"}; companies: ${r.companies.join(", ") || "n/a"}; skills: ${r.skills.join(", ") || "n/a"}\nQuantified claims:\n${r.claims.map((c) => `- ${c}`).join("\n") || "- none"}`
      : "No resume provided.",
  ]
    .filter(Boolean)
    .join("\n");
}

function transcript(history: InterviewTurn[]) {
  return history.map((t, i) => `Q${i + 1} [${t.question.type}${t.question.claim ? ` | claim: ${t.question.claim}` : ""}]: ${t.question.text}\nA${i + 1}: ${t.answer || "(no answer)"}`).join("\n\n");
}

const nextSchema = z.object({
  ack: z.string().describe("A brief, natural 3-8 word acknowledgement of the previous answer. Empty string for the first question."),
  question: z.string().describe("The next question, spoken aloud. One question only, max 45 words, conversational."),
  type: z.enum(["opener", "behavioral", "technical", "situational", "resume", "follow-up", "closing"]),
  focus: z.string().describe("Competency probed, 1-3 words, e.g. 'Ownership', 'System design'"),
  claim: z.string().describe("If type is 'resume', the exact resume claim being probed; otherwise empty string."),
});

const NEXT_SYSTEM = `You are a sharp, warm senior hiring manager running a realistic spoken interview.
Adapt to the candidate: if the last answer was vague, lacked a measurable result, overused "we", or contradicted the resume, ask ONE targeted follow-up drill-down (type "follow-up").
Otherwise move to an uncovered area. Across the interview cover: an opener, at least one resume claim verification, behavioral, technical/role-specific, situational, and a closing question.
Speak naturally — questions are read aloud by text-to-speech, so avoid lists, markdown, parentheses and abbreviations.`;

export async function nextQuestionLlm(setup: InterviewSetup, history: InterviewTurn[], plan: Plan, total: number): Promise<NextQuestionResponse | null> {
  const resolved = getModel();
  if (!resolved) return null;
  const index = history.length;
  if (index >= total) return { done: true, closing: CLOSING_LINE, index, total, meta: { engine: "llm", plan } };
  const followUps = history.filter((t) => t.question.type === "follow-up").length;
  const rules = [
    `This is question ${index + 1} of ${total}.`,
    index === 0 ? "Ask the opener." : "",
    index === total - 1 && plan === "pro" ? "This is the final question — ask a closing question." : "",
    plan === "trial" ? "Trial interview: no follow-ups; cover opener, a resume/behavioral question and one role-specific technical question." : "",
    plan === "pro" && followUps >= 2 ? "Follow-up budget used — do not ask another follow-up." : "",
    `Types already asked: ${history.map((t) => t.question.type).join(", ") || "none"}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const { output } = await generateText({
    model: resolved.model,
    system: NEXT_SYSTEM,
    prompt: `${context(setup)}\n\nInterview so far:\n${transcript(history) || "(not started)"}\n\nInstructions: ${rules}`,
    output: Output.object({ schema: nextSchema, name: "next_question" }),
    abortSignal: llmTimeout(20_000),
    maxRetries: 1,
  });

  let type = output.type as QuestionType;
  if (plan === "trial" && type === "follow-up") type = "behavioral";
  if (plan === "pro" && type === "follow-up" && followUps >= 2) type = "behavioral";
  return {
    done: false,
    ack: index === 0 ? undefined : output.ack || undefined,
    question: {
      id: `llm-${index}`,
      text: output.question,
      type,
      focus: output.focus,
      claim: type === "resume" && output.claim ? output.claim : undefined,
      parentId: type === "follow-up" ? history[history.length - 1]?.question.id : undefined,
    },
    index,
    total,
    meta: { engine: "llm", plan },
  };
}

const evalSchema = z.object({
  verdict: z.string().describe("2-3 words, e.g. 'Nearly there'"),
  summary: z.string().describe("2 sentences: the strongest moment and the biggest gap, specific to this interview"),
  domainScore: z.number().describe("0-100 role/domain competence"),
  structureScore: z.number().describe("0-100 answer structure (STAR) quality"),
  clarityScore: z.number().describe("0-100 clarity and concision of content (ignore audio delivery)"),
  strengths: z.array(z.string()).describe("3 specific strengths"),
  priorities: z.array(z.string()).describe("3 highest-leverage improvements, imperative voice"),
  alignment: z.object({
    score: z.number().describe("0-100: how well answers substantiated resume claims. 0 if no resume."),
    supported: z.array(z.object({ claim: z.string(), evidence: z.string() })),
    unsupported: z.array(z.string()),
    conflicts: z.array(z.object({ claim: z.string(), note: z.string() })),
  }),
  questions: z.array(
    z.object({
      index: z.number().describe("0-based question index"),
      score: z.number(),
      critique: z.string().describe("1-2 sentences, direct and constructive"),
      strengths: z.array(z.string()),
      improvements: z.array(z.string()),
      star: z.object({ situation: z.boolean(), task: z.boolean(), action: z.boolean(), result: z.boolean() }),
      idealAnswer: z.object({
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
      }).describe("An ideal STAR answer outline tailored to THIS candidate's background; use [brackets] for facts they must supply"),
    }),
  ),
});

const EVAL_SYSTEM = `You are an exacting interview coach scoring a mock interview transcript (speech-to-text, so ignore minor transcription errors).
Score like a real hiring panel: 85+ is exceptional, 70 is a solid hire signal, below 55 is a no-hire.
Judge resume alignment strictly: did answers substantiate the claims, and do any numbers contradict the resume?
Ideal answers must be outlines tailored to this candidate's actual background — never invent facts; use [brackets] for specifics.`;

/** LLM-written critique layered over the deterministic report (delivery metrics stay computed, not generated). */
export async function evaluateLlm(setup: InterviewSetup, turns: InterviewTurn[], base: InterviewReport): Promise<InterviewReport | null> {
  const resolved = getModel();
  if (!resolved || !turns.length) return null;

  const { output } = await generateText({
    model: resolved.model,
    system: EVAL_SYSTEM,
    prompt: `${context(setup)}\n\nTranscript:\n${transcript(turns)}`,
    output: Output.object({ schema: evalSchema, name: "interview_evaluation" }),
    abortSignal: llmTimeout(60_000),
    maxRetries: 1,
  });

  const questions = base.questions.map((q, i) => {
    const o = output.questions.find((x) => x.index === i);
    return o
      ? { ...q, score: clamp(Math.round(o.score)), critique: o.critique, strengths: o.strengths.slice(0, 3), improvements: o.improvements.slice(0, 3), star: o.star, idealAnswer: o.idealAnswer }
      : q;
  });
  const domain = clamp(Math.round(output.domainScore));
  const structure = clamp(Math.round(output.structureScore));
  const communication = clamp(Math.round(output.clarityScore * 0.5 + base.scores.delivery * 0.3 + structure * 0.2));
  const alignmentScore = base.setup.hasResume ? clamp(Math.round(output.alignment.score)) : 0;
  const overall = clamp(
    Math.round(base.setup.hasResume ? domain * 0.35 + communication * 0.3 + structure * 0.2 + alignmentScore * 0.15 : domain * 0.4 + communication * 0.35 + structure * 0.25),
  );

  return {
    ...base,
    scores: { ...base.scores, overall, domain, structure, communication, alignment: alignmentScore },
    verdict: output.verdict || base.verdict,
    summary: output.summary || base.summary,
    strengths: output.strengths.length ? output.strengths.slice(0, 3) : base.strengths,
    priorities: output.priorities.length ? output.priorities.slice(0, 3) : base.priorities,
    alignment: base.setup.hasResume ? { ...output.alignment, score: alignmentScore } : base.alignment,
    questions,
    meta: { engine: "llm", provider: resolved.provider, model: resolved.modelId, warnings: [] },
  };
}
