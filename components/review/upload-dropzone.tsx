"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown, FileText, Lock, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const MAX_BYTES = 5 * 1024 * 1024;

export function UploadDropzone({
  onFile,
  onSample,
  error,
  targetRole,
  setTargetRole,
  jobDescription,
  setJobDescription,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  error?: string | null;
  targetRole: string;
  setTargetRole: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
}) {
  const [drag, setDrag] = React.useState(false);
  const [showJd, setShowJd] = React.useState(Boolean(jobDescription));
  const input = React.useRef<HTMLInputElement>(null);

  function handle(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-xs">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Free · No sign-up required
        </span>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">See your resume the way an ATS does</h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-[15px] text-muted-foreground">
          Upload a PDF and get every red flag, green flag and rewrite pinned directly onto your document.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handle(e.dataTransfer.files);
          }}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center transition outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
            drag ? "border-indigo-500 bg-indigo-50/50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50",
            error && "border-rose-300",
          )}
          aria-label="Upload resume PDF"
        >
          <div className="relative mb-5">
            <div className="flex h-16 w-13 items-center justify-center rounded-lg border bg-white shadow-sm transition group-hover:-translate-y-0.5">
              <FileText className="size-6 text-zinc-400" />
            </div>
            <span className="absolute -bottom-1.5 -right-2 flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
              <Upload className="size-3.5" />
            </span>
          </div>
          <p className="text-[15px] font-medium">
            Drop your resume here, or <span className="text-indigo-600 underline-offset-4 group-hover:underline">browse</span>
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">PDF only · up to 5 MB</p>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => handle(e.target.files)} />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowJd((s) => !s)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            aria-expanded={showJd}
          >
            <ChevronDown className={cn("size-4 transition", showJd && "rotate-180")} /> Match against a job post (optional)
          </button>
          <Button variant="outline" size="sm" onClick={onSample}>
            <Sparkles className="text-indigo-600" /> Try a sample resume
          </Button>
        </div>

        {showJd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 grid gap-4 overflow-hidden rounded-xl border bg-white p-4">
            <div className="grid gap-2">
              <Label htmlFor="target-role">Target role</Label>
              <Input id="target-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Senior Product Manager" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="jd">Job description</Label>
              <Textarea
                id="jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job post to score keyword match against it…"
                className="max-h-56 min-h-28"
              />
            </div>
          </motion.div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> Parsed in your browser. Only extracted text is sent for analysis — never stored without your consent.
        </p>
      </motion.div>
    </div>
  );
}
