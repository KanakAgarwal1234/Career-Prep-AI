import { z } from "zod";

const str = (max: number) => z.string().max(max);

export const resumeProfileSchema = z.object({
  name: str(120).optional(),
  headline: str(160).optional(),
  titles: z.array(str(160)).max(10),
  companies: z.array(str(160)).max(10),
  skills: z.array(str(80)).max(40),
  claims: z.array(str(600)).max(10),
  yearsExperience: z.number().optional(),
  text: str(14000),
  source: z.enum(["ats-audit", "upload", "paste"]),
  fileName: str(260).optional(),
});

export const setupSchema = z.object({
  sessionId: str(80),
  role: str(120).min(2, "Enter a target job title"),
  industry: str(120),
  level: z.enum(["entry", "mid", "senior", "lead"]),
  jobDescription: str(12000).optional(),
  resume: resumeProfileSchema.optional(),
  plan: z.enum(["trial", "pro"]),
  inputMode: z.enum(["voice", "text"]),
});

export const questionSchema = z.object({
  id: str(80),
  text: str(1200),
  type: z.enum(["opener", "behavioral", "technical", "situational", "resume", "follow-up", "closing"]),
  focus: str(80),
  claim: str(600).optional(),
  parentId: str(80).optional(),
});

export const metricsSchema = z.object({
  words: z.number(),
  durationSec: z.number(),
  speakingSec: z.number(),
  wpm: z.number(),
  fillerCount: z.number(),
  fillers: z.record(z.string(), z.number()),
  pauses: z.object({ short: z.number(), medium: z.number(), long: z.number() }),
  longestPauseSec: z.number(),
  latencySec: z.number(),
  hedgeCount: z.number(),
  sttConfidence: z.number().optional(),
});

export const turnSchema = z.object({ question: questionSchema, answer: str(12000), metrics: metricsSchema });

export const interviewBodySchema = z.object({ setup: setupSchema, history: z.array(turnSchema).max(10) });
