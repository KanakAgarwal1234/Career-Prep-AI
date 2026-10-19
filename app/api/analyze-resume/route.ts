import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeResumeHeuristic } from "@/lib/resume/analyze";
import { enhanceWithLlm } from "@/lib/ai/resume-llm";
import { allowLlmCall } from "@/lib/rate-limit";
import type { ExtractedResume } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const lineSchema = z.object({
  id: z.string().max(24),
  page: z.number().int().min(1).max(20),
  text: z.string().max(2000),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  fontSize: z.number(),
  segments: z.array(z.object({ x: z.number(), text: z.string().max(2000) })).max(12),
});

const bodySchema = z.object({
  resume: z.object({
    fileName: z.string().max(260),
    fileSize: z.number().max(5 * 1024 * 1024, "PDF must be 5 MB or smaller"),
    pageCount: z.number().int().min(1).max(20),
    pages: z.array(z.object({ width: z.number(), height: z.number() })).max(20),
    lines: z.array(lineSchema).max(1500),
  }),
  jobDescription: z.string().max(12000).optional(),
  targetRole: z.string().max(120).optional(),
  /** "offline" forces the deterministic engine (useful for demos/tests). */
  engine: z.enum(["auto", "offline"]).optional(),
});

/**
 * POST /api/analyze-resume
 * Body: { resume: ExtractedResume, jobDescription?, targetRole? }
 * The browser extracts positioned text with pdf.js (so coordinates match the
 * rendered canvas exactly) and posts it here. Returns a ResumeAnalysis whose
 * annotations carry normalised page coordinates.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid JSON body";
    return NextResponse.json({ error: message || "Invalid request" }, { status: 400 });
  }

  const resume = body.resume as ExtractedResume;
  const opts = { jobDescription: body.jobDescription?.trim() || undefined, targetRole: body.targetRole?.trim() || undefined };
  const base = analyzeResumeHeuristic(resume, opts);

  if (body.engine !== "offline" && base.metrics.wordCount >= 40) {
    if (!allowLlmCall(req)) {
      base.meta.warnings.push("Rate limit reached — served by the offline engine.");
    } else {
      try {
        const enhanced = await enhanceWithLlm(resume, base, opts);
        if (enhanced) return NextResponse.json(enhanced);
      } catch (err) {
        console.error("[analyze-resume] LLM failed, falling back", err);
        base.meta.warnings.push("AI model unavailable — served by the offline engine.");
      }
    }
  }
  return NextResponse.json(base);
}
