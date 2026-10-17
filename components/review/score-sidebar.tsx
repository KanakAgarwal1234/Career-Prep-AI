"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, CloudUpload, Download, FilePlus2, Gauge, Hash, LayoutTemplate, Loader2, PanelLeftClose, PanelLeftOpen, Percent } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScoreRing } from "@/components/shared/score-ring";
import type { AnnotationType, ResumeAnalysis, Severity } from "@/lib/types";
import { cn, scoreLabel, scoreTone } from "@/lib/utils";
import { SEVERITY_STYLE, TYPE_META } from "./annotation-style";

export interface Filters {
  severities: Set<Severity>;
  types: Set<AnnotationType>;
}

function Metric({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint: string; tone: "good" | "fair" | "poor" }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-zinc-50 text-zinc-500">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular text-[15px] font-semibold tracking-tight">{value}</div>
      </div>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
          tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "fair" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700",
        )}
      >
        {hint}
      </span>
    </div>
  );
}

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[13px] transition",
        active ? "border-zinc-200 bg-white text-zinc-900 shadow-xs" : "border-transparent bg-transparent text-zinc-400 line-through decoration-zinc-300",
      )}
    >
      <span className="flex items-center gap-2">{children}</span>
      <span className="tabular text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

export function ScoreSidebar({
  analysis,
  fileName,
  filters,
  setFilters,
  collapsed,
  setCollapsed,
  onReset,
  onDownload,
  onSave,
  busy,
}: {
  analysis: ResumeAnalysis;
  fileName: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  onReset: () => void;
  onDownload: () => void;
  onSave: () => void;
  busy: "download" | "save" | null;
}) {
  const m = analysis.metrics;
  const count = (pred: (a: ResumeAnalysis["annotations"][number]) => boolean) => analysis.annotations.filter(pred).length;
  const flip = <V,>(set: Set<V>, v: V) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  if (collapsed) {
    return (
      <div className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r bg-white py-3 lg:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(false)} aria-label="Expand score panel">
              <PanelLeftOpen />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand</TooltipContent>
        </Tooltip>
        <ScoreRing value={analysis.overallScore} size={40} stroke={4} />
        <div className="flex flex-col items-center gap-1.5 text-[11px] font-medium tabular">
          <span className="flex items-center gap-1 text-rose-600"><span className="size-1.5 rounded-full bg-rose-500" />{count((a) => a.severity === "critical")}</span>
          <span className="flex items-center gap-1 text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />{count((a) => a.severity === "warning")}</span>
          <span className="flex items-center gap-1 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />{count((a) => a.severity === "positive")}</span>
        </div>
      </div>
    );
  }

  const kwTone = analysis.scores.keywords >= 70 ? "good" : analysis.scores.keywords >= 40 ? "fair" : "poor";
  return (
    <aside className="scrollbar-thin flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b bg-white p-4 lg:w-[264px] lg:border-b-0 lg:border-r lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">ATS Audit</div>
          <div className="truncate text-sm font-medium" title={fileName}>{fileName}</div>
        </div>
        <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={() => setCollapsed(true)} aria-label="Collapse score panel">
          <PanelLeftClose />
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 lg:flex-col lg:items-start">
        <ScoreRing value={analysis.overallScore} label="ATS score" size={120} />
        <div className="lg:w-full">
          <Badge variant={scoreTone(analysis.overallScore) === "good" ? "success" : scoreTone(analysis.overallScore) === "fair" ? "warning" : "danger"}>
            {scoreLabel(analysis.overallScore)}
          </Badge>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{analysis.summary}</p>
        </div>
      </motion.div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        <Metric
          icon={Percent}
          label="Quantified impact"
          value={`${m.quantifiedImpactPct}%`}
          hint={`${m.quantifiedBullets}/${m.bulletCount} bullets`}
          tone={m.quantifiedImpactPct >= 60 ? "good" : m.quantifiedImpactPct >= 35 ? "fair" : "poor"}
        />
        <Metric
          icon={LayoutTemplate}
          label="Formatting risk"
          value={m.formattingRisk[0].toUpperCase() + m.formattingRisk.slice(1)}
          hint={`${analysis.scores.formatting}/100`}
          tone={m.formattingRisk === "low" ? "good" : m.formattingRisk === "medium" ? "fair" : "poor"}
        />
        <Metric icon={Hash} label="Keyword density" value={`${m.keywordDensityPct}%`} hint={`${analysis.keywords.matched.length} matched`} tone={kwTone} />
      </div>

      <div className="hidden lg:block">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Gauge className="size-3" /> Show on document
        </div>
        <div className="grid gap-1">
          {(["critical", "warning", "positive"] as const).map((sev) => (
            <Chip key={sev} active={filters.severities.has(sev)} onClick={() => setFilters({ ...filters, severities: flip(filters.severities, sev) })} count={count((a) => a.severity === sev)}>
              <span className={cn("size-2 rounded-full", SEVERITY_STYLE[sev].dot)} />
              {sev === "critical" ? "Red flags" : sev === "warning" ? "Improvements" : "Green flags"}
            </Chip>
          ))}
          <div className="my-1.5 h-px bg-border" />
          {(["ats", "impact", "format"] as const).map((t) => {
            const T = TYPE_META[t];
            return (
              <Chip key={t} active={filters.types.has(t)} onClick={() => setFilters({ ...filters, types: flip(filters.types, t) })} count={count((a) => a.type === t)}>
                <T.icon className="size-3.5 text-zinc-500" /> {T.label === "ATS" ? "ATS parsing" : T.label === "Impact" ? "Content impact" : "Formatting"}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="mt-auto grid gap-2 pt-2">
        <Button onClick={onDownload} disabled={busy !== null}>
          {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download full report
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <CloudUpload />} Save
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <FilePlus2 /> New file
          </Button>
        </div>
        <Link
          href="/interview"
          className="group mt-2 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-[13px] font-medium text-indigo-900 transition hover:bg-indigo-50"
        >
          Practice interviewing on this resume
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </aside>
  );
}
