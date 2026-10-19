import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Annotation, ExtractedResume, ResumeAnalysis } from "@/lib/types";
import { blocksForPrompt } from "@/lib/resume/analyze";
import { clamp } from "@/lib/utils";
import { getModel, llmTimeout } from "./provider";

const schema = z.object({
  summary: z.string().describe("2 sentences: overall verdict + the single biggest lift. Plain, specific, no fluff."),
  detectedRole: z.string().describe("Most likely target role, e.g. 'Senior Product Manager'"),
  impactScore: z.number().describe("0-100 content impact score"),
  annotations: z
    .array(
      z.object({
        blockId: z.string().describe("id of the block being annotated, copied exactly"),
        severity: z.enum(["critical", "warning", "positive"]),
        title: z.string().describe("2-5 word label, e.g. 'Passive opener', 'Missing metric', 'Quantified impact'"),
        suggestedText: z.string().describe("Rewritten bullet. Use [brackets] for numbers the candidate must supply. Never invent facts. For positives, repeat the original."),
        note: z.string().describe("1-2 sentences: why it matters to a recruiter/ATS"),
      }),
    )
    .describe("6-14 annotations on the highest-leverage blocks, including 2-4 positives"),
  missingKeywords: z.array(z.string()).describe("Up to 8 important keywords for the target role absent from the resume"),
});

const SYSTEM = `You are a senior technical recruiter and ATS specialist who has screened 20,000+ resumes.
You audit resume bullets for recruiter impact: strong action verbs, quantified outcomes, ownership, concision.
Rules:
- Only annotate blocks you are given, referencing their exact blockId.
- Rewrites must keep the candidate's real facts. Where a number is unknown, insert a bracketed placeholder like [X%] or [$Y] — never fabricate results.
- Be direct and specific. No generic advice, no emojis.`;

/**
 * Upgrades the heuristic audit with LLM-written content annotations.
 * Structural/parser checks stay deterministic (they come from layout geometry
 * an LLM can't see); content annotations + summary come from the model.
 */
export async function enhanceWithLlm(
  resume: ExtractedResume,
  base: ResumeAnalysis,
  opts: { jobDescription?: string; targetRole?: string },
): Promise<ResumeAnalysis | null> {
  const resolved = getModel();
  if (!resolved) return null;

  const blocks = blocksForPrompt(resume).filter((b) => b.text.split(" ").length >= 4).slice(0, 60);
  if (blocks.length < 3) return null;
  const byId = new Map(blocks.map((b) => [b.id, b]));

  const prompt = [
    opts.targetRole ? `Target role: ${opts.targetRole}` : `Detected role family: ${base.keywords.family}`,
    opts.jobDescription ? `Job description (truncated):\n${opts.jobDescription.slice(0, 3500)}` : "",
    `Resume blocks (id | section | text):`,
    ...blocks.map((b) => `${b.id} | ${b.section} | ${b.text}`),
  ]
    .filter(Boolean)
    .join("\n");

  const { output } = await generateText({
    model: resolved.model,
    system: SYSTEM,
    prompt,
    output: Output.object({ schema, name: "resume_audit" }),
    abortSignal: llmTimeout(),
    maxRetries: 1,
  });

  const llmAnnotations: Annotation[] = [];
  const seen = new Set<string>();
  output.annotations.forEach((a, i) => {
    const block = byId.get(a.blockId);
    if (!block || seen.has(a.blockId)) return;
    seen.add(a.blockId);
    const pad = 0.004;
    llmAnnotations.push({
      id: `l${i + 1}`,
      page: block.box.page,
      x: Math.max(0, block.box.x - pad),
      y: Math.max(0, block.box.y - pad),
      width: Math.min(1, block.box.width + pad * 2),
      height: block.box.height + pad * 2,
      type: "impact",
      severity: a.severity,
      title: a.title,
      originalText: block.text,
      suggestedText: a.severity === "positive" ? block.text : a.suggestedText,
      note: a.note,
    });
  });
  if (llmAnnotations.length < 3) return null;

  // Keep deterministic ATS/format annotations; replace heuristic content ones.
  const structural = base.annotations.filter((a) => a.type !== "impact" || a.title === "Outdated line");
  const annotations = [...structural, ...llmAnnotations].sort((a, z) => a.page - z.page || a.y - z.y);
  const impact = clamp(Math.round(base.scores.impact * 0.4 + clamp(output.impactScore) * 0.6));
  const missing = Array.from(new Set([...output.missingKeywords, ...base.keywords.missing])).slice(0, 12);
  const overall = clamp(Math.round(base.scores.ats * 0.4 + impact * 0.4 + base.scores.keywords * 0.2));

  // Re-point content fixes at the new annotation ids.
  const critical = llmAnnotations.filter((a) => a.severity === "critical").map((a) => a.id);
  const warn = llmAnnotations.filter((a) => a.severity === "warning").map((a) => a.id);
  const fixes = base.fixes.map((f) =>
    f.id === "f-weak" ? { ...f, annotationIds: critical } : f.id === "f-metrics" ? { ...f, annotationIds: warn } : f,
  );

  return {
    ...base,
    overallScore: overall,
    scores: { ...base.scores, impact },
    keywords: { ...base.keywords, missing },
    annotations,
    fixes,
    summary: output.summary || base.summary,
    detectedRole: output.detectedRole || base.detectedRole,
    meta: { ...base.meta, engine: "llm", provider: resolved.provider, model: resolved.modelId },
  };
}
