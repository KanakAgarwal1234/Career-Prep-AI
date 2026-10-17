"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, ClipboardPaste, FileCheck2, FileUp, Keyboard, Loader2, Lock, Mic, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/components/providers/app-provider";
import { buildResumeProfile, suggestLevel } from "@/lib/resume/profile";
import { KEYS, readJSON, writeJSON } from "@/lib/storage";
import type { ExperienceLevel, InterviewSetup, Plan, ResumeProfile } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

const INDUSTRIES = ["Technology / SaaS", "Healthcare", "Finance & Banking", "E-commerce & Retail", "Consulting", "Media & Entertainment", "Education", "Manufacturing", "Government & Non-profit", "Other"];

export function SetupForm({ onStart }: { onStart: (setup: InterviewSetup) => void }) {
  const { plan: accountPlan, openUpgrade } = useApp();
  const [resume, setResume] = React.useState<ResumeProfile | null>(null);
  const [resumeMode, setResumeMode] = React.useState<"none" | "paste">("none");
  const [pasted, setPasted] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [role, setRole] = React.useState("");
  const [industry, setIndustry] = React.useState(INDUSTRIES[0]);
  const [level, setLevel] = React.useState<ExperienceLevel>("mid");
  const [jd, setJd] = React.useState("");
  const [plan, setPlan] = React.useState<Plan>("trial");
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice");
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("role");
    if (fromQuery) setRole(fromQuery.slice(0, 120));
    const saved = readJSON<ResumeProfile>(KEYS.resumeProfile);
    if (saved) applyResume(saved, false);
  }, []);

  React.useEffect(() => {
    if (accountPlan === "pro") setPlan("pro");
  }, [accountPlan]);

  function applyResume(p: ResumeProfile, persist = true) {
    setResume(p);
    if (p.headline) setRole((r) => r || p.headline!);
    setLevel(suggestLevel(p.yearsExperience));
    if (persist) writeJSON(KEYS.resumeProfile, p);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast.error("Upload a PDF resume");
    if (f.size > 5 * 1024 * 1024) return toast.error("PDF must be 5 MB or smaller");
    setParsing(true);
    try {
      const { openPdf, extractResume, resumePlainText, closePdf } = await import("@/lib/pdf/client");
      const doc = await openPdf(await f.arrayBuffer());
      const ex = await extractResume(doc, { name: f.name, size: f.size });
      closePdf(doc);
      applyResume(buildResumeProfile(resumePlainText(ex), "upload", f.name));
      toast.success("Resume loaded", { description: "The interviewer will probe your real claims." });
    } catch {
      toast.error("Couldn't read that PDF");
    } finally {
      setParsing(false);
    }
  }

  function applyPasted() {
    if (pasted.trim().length < 150) return toast.error("Paste a bit more of your resume (150+ characters)");
    applyResume(buildResumeProfile(pasted, "paste"));
    setResumeMode("none");
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (role.trim().length < 2) return setError("Add the job title you're interviewing for.");
    if (plan === "pro" && accountPlan !== "pro") return openUpgrade("The full 7-question adaptive interview is part of Pro.");
    setError(null);
    onStart({
      sessionId: uid("sess"),
      role: role.trim(),
      industry,
      level,
      jobDescription: jd.trim() || undefined,
      resume: resume || undefined,
      plan,
      inputMode,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 max-w-2xl">
        <Badge variant="indigo" className="mb-3">
          <Mic /> Adaptive voice interview
        </Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Rehearse the interview before it counts</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          An AI hiring manager asks targeted questions out loud, listens, and drills into vague answers — then scores your content and delivery.
        </p>
      </motion.div>

      <form onSubmit={start} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          {/* Step 1 — resume context */}
          <section className="rounded-xl border bg-white p-5 sm:p-6">
            <StepTitle n={1} title="Resume context" hint="The interviewer verifies the claims you make on paper." />
            {resume ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
                <FileCheck2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {resume.fileName || "Pasted resume"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {resume.source === "ats-audit" ? "from your ATS audit" : resume.source === "upload" ? "uploaded" : "pasted"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {resume.headline && <Badge variant="outline">{resume.headline}</Badge>}
                    {resume.yearsExperience !== undefined && <Badge variant="outline">~{resume.yearsExperience} yrs</Badge>}
                    <Badge variant="outline">{resume.claims.length} quantified claims</Badge>
                    <Badge variant="outline">{resume.skills.length} skills</Badge>
                  </div>
                </div>
                <button type="button" onClick={() => setResume(null)} className="rounded p-1 text-muted-foreground hover:bg-white" aria-label="Remove resume">
                  <X className="size-4" />
                </button>
              </div>
            ) : resumeMode === "paste" ? (
              <div className="grid gap-2">
                <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste your resume text…" className="max-h-64 min-h-36" autoFocus />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setResumeMode("none")}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" variant="dark" onClick={applyPasted}>
                    <Check /> Use this text
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {parsing ? <Loader2 className="size-4 animate-spin text-indigo-600" /> : <FileUp className="size-4 text-zinc-500" />}
                  <span className="text-sm font-medium">Upload PDF</span>
                  <span className="text-xs text-muted-foreground">Parsed in your browser</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResumeMode("paste")}
                  className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <ClipboardPaste className="size-4 text-zinc-500" />
                  <span className="text-sm font-medium">Paste text</span>
                  <span className="text-xs text-muted-foreground">From any doc</span>
                </button>
                <Link href="/review" className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50">
                  <Sparkles className="size-4 text-indigo-600" />
                  <span className="text-sm font-medium">Run ATS audit first</span>
                  <span className="text-xs text-muted-foreground">Carries over automatically</span>
                </Link>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
            )}
          </section>

          {/* Step 2 — role */}
          <section className="rounded-xl border bg-white p-5 sm:p-6">
            <StepTitle n={2} title="The role" hint="Questions adapt to the function, seniority and job post." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="role">Target job title</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Product Manager" aria-invalid={!!error} />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <NativeSelect id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  {INDUSTRIES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label>Experience level</Label>
                <Segmented
                  ariaLabel="Experience level"
                  value={level}
                  onChange={setLevel}
                  options={[
                    { value: "entry", label: "Entry" },
                    { value: "mid", label: "Mid" },
                    { value: "senior", label: "Senior" },
                    { value: "lead", label: "Lead" },
                  ]}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="jd">
                  Job description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job post for sharper, role-specific questions…" className="max-h-48 min-h-24" />
              </div>
            </div>
          </section>
        </div>

        {/* Step 3 — session */}
        <aside className="h-fit rounded-xl border bg-white p-5 lg:sticky lg:top-20">
          <StepTitle n={3} title="Session" />
          <div className="grid gap-2">
            <PlanOption
              active={plan === "trial"}
              onClick={() => setPlan("trial")}
              title="Free trial"
              meta="3 questions"
              points={["Opener, resume & role questions", "Core scorecard"]}
            />
            <PlanOption
              active={plan === "pro"}
              onClick={() => setPlan("pro")}
              title="Full interview"
              meta={accountPlan === "pro" ? "7 questions" : "Pro"}
              locked={accountPlan !== "pro"}
              points={["7 adaptive questions + drill-downs", "Voice & delivery analytics"]}
            />
          </div>

          <div className="mt-5 grid gap-2">
            <Label>Answer by</Label>
            <Segmented
              ariaLabel="Answer mode"
              value={inputMode}
              onChange={setInputMode}
              options={[
                { value: "voice", label: "Speaking" },
                { value: "text", label: "Typing" },
              ]}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {inputMode === "voice" ? <Mic className="size-3" /> : <Keyboard className="size-3" />}
              {inputMode === "voice" ? "Best in Chrome or Edge. We'll check your mic next." : "Delivery analytics need voice mode."}
            </p>
          </div>

          <Button type="submit" size="lg" className="mt-5 w-full">
            {plan === "pro" && accountPlan !== "pro" ? <Lock /> : null}
            {plan === "pro" && accountPlan !== "pro" ? "Unlock full interview" : "Continue"}
            <ArrowRight />
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">~{plan === "pro" ? "15" : "6"} minutes · audio never leaves your browser in standard mode</p>
        </aside>
      </form>
    </div>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{n}</span>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function PlanOption({ active, onClick, title, meta, points, locked }: { active: boolean; onClick: () => void; title: string; meta: string; points: string[]; locked?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn("rounded-lg border p-3.5 text-left transition", active ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500" : "hover:border-zinc-300")}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className={cn("flex items-center gap-1 text-xs", locked ? "text-indigo-700" : "text-muted-foreground")}>
          {locked && <Lock className="size-3" />} {meta}
        </span>
      </div>
      <ul className="mt-2 grid gap-1">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3 text-zinc-400" /> {p}
          </li>
        ))}
      </ul>
    </button>
  );
}
