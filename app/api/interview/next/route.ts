import { NextResponse } from "next/server";
import { z } from "zod";
import { interviewBodySchema } from "@/lib/interview/schemas";
import { nextQuestionOffline, QUESTION_COUNT } from "@/lib/interview/planner";
import { nextQuestionLlm } from "@/lib/ai/interview-llm";
import { resolvePlan } from "@/lib/entitlements";
import { allowLlmCall } from "@/lib/rate-limit";
import type { InterviewSetup, InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/interview/next
 * Body: { setup, history: [{ question, answer, metrics }] }
 * Returns the next adaptive question (or { done: true }). The question cap is
 * enforced here from the caller's verified plan — trial = 3, pro = 7.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof interviewBodySchema>;
  try {
    body = interviewBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request" }, { status: 400 });
  }
  const entitled = await resolvePlan(req);
  const plan = body.setup.plan === "pro" && entitled === "pro" ? "pro" : "trial";
  const setup = { ...body.setup, plan } as InterviewSetup;
  const history = body.history as InterviewTurn[];
  const total = QUESTION_COUNT[plan];

  if (history.length < total && allowLlmCall(req, Number(process.env.LLM_RATE_LIMIT) || 60)) {
    try {
      const llm = await nextQuestionLlm(setup, history, plan, total);
      if (llm) return NextResponse.json(llm);
    } catch (err) {
      console.error("[interview/next] LLM failed, using offline planner", err);
    }
  }
  return NextResponse.json(nextQuestionOffline(setup, history, plan));
}
