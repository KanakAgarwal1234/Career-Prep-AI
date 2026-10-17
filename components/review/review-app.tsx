"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { UploadDropzone, MAX_BYTES } from "./upload-dropzone";
import { ReviewWorkspace } from "./review-workspace";
import { closePdf, extractResume, openPdf, resumePlainText } from "@/lib/pdf/client";
import { buildResumeProfile } from "@/lib/resume/profile";
import { KEYS, writeJSON } from "@/lib/storage";
import type { ExtractedResume, ResumeAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Reading PDF", "Mapping layout & reading order", "Running ATS parser checks", "Scoring content impact"];

export interface LoadedResume {
  file: { name: string; size: number };
  bytes: ArrayBuffer;
  doc: PDFDocumentProxy;
  extracted: ExtractedResume;
}

export async function requestAnalysis(extracted: ExtractedResume, opts: { jobDescription?: string; targetRole?: string }) {
  const res = await fetch("/api/analyze-resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resume: extracted, ...opts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  return data as ResumeAnalysis;
}

export function ReviewApp() {
  const [phase, setPhase] = React.useState<"idle" | "processing" | "ready">("idle");
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState<LoadedResume | null>(null);
  const [analysis, setAnalysis] = React.useState<ResumeAnalysis | null>(null);
  const [targetRole, setTargetRole] = React.useState("");
  const [jobDescription, setJobDescription] = React.useState("");

  const process = React.useCallback(
    async (file: { name: string; size: number }, bytes: ArrayBuffer) => {
      setError(null);
      setPhase("processing");
      setStep(0);
      try {
        const doc = await openPdf(bytes);
        setStep(1);
        const extracted = await extractResume(doc, file);
        setStep(2);
        const pending = requestAnalysis(extracted, { jobDescription: jobDescription || undefined, targetRole: targetRole || undefined });
        // keep each step on screen long enough to read
        await new Promise((r) => setTimeout(r, 450));
        setStep(3);
        const result = await pending;
        await new Promise((r) => setTimeout(r, 300));

        writeJSON(KEYS.resumeProfile, buildResumeProfile(resumePlainText(extracted), "ats-audit", file.name));
        setLoaded({ file, bytes, doc, extracted });
        setAnalysis(result);
        setPhase("ready");
        if (result.meta.warnings.length) toast.message(result.meta.warnings[0]);
      } catch (err) {
        console.error(err);
        const msg = (err as Error).message || "";
        setError(/password/i.test(msg) ? "This PDF is password-protected. Remove the password and try again." : /Invalid PDF|corrupt/i.test(msg) ? "That file doesn't look like a valid PDF." : msg || "Something went wrong reading that PDF.");
        setPhase("idle");
      }
    },
    [jobDescription, targetRole],
  );

  const onFile = React.useCallback(
    async (f: File) => {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setError("Please upload a PDF file.");
      if (f.size > MAX_BYTES) return setError("That file is over 5 MB. Compress it or export a lighter PDF.");
      process({ name: f.name, size: f.size }, await f.arrayBuffer());
    },
    [process],
  );

  const onSample = React.useCallback(async () => {
    const res = await fetch("/sample-resume.pdf");
    const bytes = await res.arrayBuffer();
    process({ name: "jordan-lee-resume.pdf", size: bytes.byteLength }, bytes);
  }, [process]);

  const reanalyze = React.useCallback(
    async (opts: { jobDescription?: string; targetRole?: string }) => {
      if (!loaded) return;
      setJobDescription(opts.jobDescription || "");
      if (opts.targetRole !== undefined) setTargetRole(opts.targetRole);
      const result = await requestAnalysis(loaded.extracted, opts);
      setAnalysis(result);
      return result;
    },
    [loaded],
  );

  const reset = React.useCallback(() => {
    if (loaded) closePdf(loaded.doc);
    setLoaded(null);
    setAnalysis(null);
    setPhase("idle");
  }, [loaded]);

  if (phase === "ready" && loaded && analysis) {
    return <ReviewWorkspace loaded={loaded} analysis={analysis} onReset={reset} onReanalyze={reanalyze} jobDescription={jobDescription} targetRole={targetRole} />;
  }

  return (
    <div className="bg-grid min-h-[calc(100dvh-3.5rem)] [background-position:center_-1px]">
      <div className="min-h-[calc(100dvh-3.5rem)] bg-gradient-to-b from-background/40 via-background/90 to-background">
        <AnimatePresence mode="wait">
          {phase === "processing" ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto flex max-w-sm flex-col items-center px-4 py-28"
            >
              <div className="relative mb-8 h-36 w-28 overflow-hidden rounded-lg border bg-white shadow-sm">
                {[14, 26, 34, 46, 54, 62, 74, 82, 90, 102, 110].map((top, i) => (
                  <div key={top} className="absolute left-3 h-1.5 rounded-full bg-zinc-100" style={{ top, width: `${55 + ((i * 37) % 30)}%` }} />
                ))}
                <motion.div
                  className="absolute inset-x-0 h-8 bg-gradient-to-b from-indigo-500/0 via-indigo-500/15 to-indigo-500/0"
                  animate={{ top: ["-15%", "95%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                />
              </div>
              <ol className="w-full space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-3 text-sm transition", i > step ? "text-zinc-400" : "text-zinc-900")}>
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border",
                        i < step && "border-emerald-500 bg-emerald-500 text-white",
                        i === step && "border-indigo-500",
                      )}
                    >
                      {i < step ? <Check className="size-3" /> : i === step ? <Loader2 className="size-3 animate-spin text-indigo-600" /> : null}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UploadDropzone
                onFile={onFile}
                onSample={onSample}
                error={error}
                targetRole={targetRole}
                setTargetRole={setTargetRole}
                jobDescription={jobDescription}
                setJobDescription={setJobDescription}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
