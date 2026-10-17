import { NextResponse } from "next/server";
import { z } from "zod";
import { interviewBodySchema } from "@/lib/interview/schemas";
import { evaluateInterviewHeuristic } from "@/lib/interview/evaluate";
import { evaluateLlm } from "@/lib/ai/interview-llm";
import { resolvePlan } from "@/lib/entitlements";
import { allowLlmCall } from "@/lib/rate-limit";
import type { InterviewSetup, InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/interview/evaluate
 * Body: { setup, history } — the full transcript with per-answer delivery metrics.
 * Returns an InterviewReport: executive scorecard, resume alignment, voice &
 * delivery analytics and a question-by-question replay with STAR frameworks.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof interviewBodySchema>;
  try {
    body = interviewBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request" }, { status: 400 });
  }
  const entitled = await resolvePlan(req);
  const setup = { ...body.setup, plan: body.setup.plan === "pro" && entitled === "pro" ? "pro" : "trial" } as InterviewSetup;
  const turns = body.history as InterviewTurn[];
  const base = evaluateInterviewHeuristic(setup, turns);

  if (turns.some((t) => t.answer.trim().length > 20)) {
    if (!allowLlmCall(req)) {
      base.meta.warnings.push("Rate limit reached — scored by the offline engine.");
    } else {
      try {
        const llm = await evaluateLlm(setup, turns, base);
        if (llm) return NextResponse.json(llm);
      } catch (err) {
        console.error("[interview/evaluate] LLM failed, using offline scorer", err);
        base.meta.warnings.push("AI model unavailable — scored by the offline engine.");
      }
    }
  }
  return NextResponse.json(base);
}
