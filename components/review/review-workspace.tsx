"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ResumeAnalysis } from "@/lib/types";
import type { LoadedResume } from "./review-app";
import { DocumentStage } from "./document-stage";
import { ScoreSidebar, type Filters } from "./score-sidebar";
import { InspectorPanel } from "./inspector-panel";
import { useApp } from "@/components/providers/app-provider";
import { getSupabase, RESUME_BUCKET } from "@/lib/supabase/client";

export function ReviewWorkspace({
  loaded,
  analysis,
  onReset,
  onReanalyze,
  jobDescription,
  targetRole,
}: {
  loaded: LoadedResume;
  analysis: ResumeAnalysis;
  onReset: () => void;
  onReanalyze: (opts: { jobDescription?: string; targetRole?: string }) => Promise<unknown>;
  jobDescription: string;
  targetRole: string;
}) {
  const { requireAuth } = useApp();
  const [activeId, setActiveIdRaw] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [busy, setBusy] = React.useState<"download" | "save" | null>(null);
  const [filters, setFilters] = React.useState<Filters>({
    severities: new Set(["critical", "warning", "positive"]),
    types: new Set(["ats", "impact", "format"]),
  });

  const visible = React.useMemo(
    () => analysis.annotations.filter((a) => filters.severities.has(a.severity) && filters.types.has(a.type)),
    [analysis.annotations, filters],
  );
  const ordered = React.useMemo(() => [...visible].sort((a, b) => a.page - b.page || a.y - b.y), [visible]);
  const indexMap = React.useMemo(() => new Map(ordered.map((a, i) => [a.id, i])), [ordered]);
  const indexOf = React.useCallback((id: string) => indexMap.get(id) ?? 0, [indexMap]);

  const setActiveId = React.useCallback((id: string | null) => {
    setActiveIdRaw(id);
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`ann-${id}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 110 || r.bottom > window.innerHeight - 260) el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  const focus = React.useCallback(
    (id: string) => {
      const ann = analysis.annotations.find((a) => a.id === id);
      if (ann && (!filters.severities.has(ann.severity) || !filters.types.has(ann.type))) {
        setFilters({ severities: new Set([...filters.severities, ann.severity]), types: new Set([...filters.types, ann.type]) });
      }
      setActiveId(id);
    },
    [analysis.annotations, filters, setActiveId],
  );

  async function download() {
    const user = await requireAuth("Sign in to download your full annotated report.");
    if (!user) return;
    setBusy("download");
    try {
      const { buildResumeReportPdf } = await import("@/lib/export/resume-report");
      const pdf = await buildResumeReportPdf(loaded.doc, analysis, loaded.file.name);
      pdf.save(`${loaded.file.name.replace(/\.pdf$/i, "")}-ats-report.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't build the report");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const user = await requireAuth("Sign in to save this audit and track your score over time.");
    if (!user) return;
    setBusy("save");
    try {
      const sb = getSupabase();
      if (sb && !user.demo) {
        const path = `${user.id}/${Date.now()}-${loaded.file.name.replace(/[^\w.-]+/g, "_")}`;
        const up = await sb.storage.from(RESUME_BUCKET).upload(path, new Blob([loaded.bytes], { type: "application/pdf" }), { upsert: false });
        if (up.error) throw up.error;
        const ins = await sb.from("resume_reviews").insert({
          user_id: user.id,
          file_path: path,
          file_name: loaded.file.name,
          overall_score: analysis.overallScore,
          result: analysis,
        });
        if (ins.error) throw ins.error;
        toast.success("Saved to your account");
      } else {
        const key = "cp.savedReviews";
        const list = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
        list.unshift({ fileName: loaded.file.name, score: analysis.overallScore, savedAt: new Date().toISOString(), summary: analysis.summary });
        localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
        toast.success("Saved", { description: "Demo mode: stored in this browser. Connect Supabase to sync to the cloud." });
      }
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row lg:overflow-hidden">
      <ScoreSidebar
        analysis={analysis}
        fileName={loaded.file.name}
        filters={filters}
        setFilters={setFilters}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onReset={onReset}
        onDownload={download}
        onSave={save}
        busy={busy}
      />
      <main className="flex min-h-[70dvh] min-w-0 flex-1 flex-col bg-stage lg:min-h-0 lg:overflow-y-auto" id="stage-scroll">
        <DocumentStage
          doc={loaded.doc}
          annotations={visible}
          activeId={activeId}
          hoverId={hoverId}
          setActiveId={setActiveId}
          setHoverId={setHoverId}
          indexOf={indexOf}
        />
      </main>
      <InspectorPanel
        analysis={analysis}
        activeId={activeId}
        onFocus={focus}
        indexOf={indexOf}
        onReanalyze={onReanalyze}
        jobDescription={jobDescription}
        targetRole={targetRole}
        fileKey={`${loaded.file.name}:${loaded.file.size}`}
      />
    </div>
  );
}
