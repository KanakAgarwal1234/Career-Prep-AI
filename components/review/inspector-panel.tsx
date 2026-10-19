"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleCheck, Copy, Crosshair, Loader2, RefreshCw, ScanSearch, TrendingUp, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScoreBar } from "@/components/shared/score-ring";
import type { Annotation, ResumeAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KEYS, readJSON, writeJSON } from "@/lib/storage";
import { SEVERITY_STYLE } from "./annotation-style";
import { copyText } from "./annotation-card";

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

function ScoreHeader({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="rounded-lg border bg-white p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular text-lg font-semibold tracking-tight">
          {value}
          <span className="text-xs font-normal text-muted-foreground">/100</span>
        </span>
      </div>
      <ScoreBar value={value} className="mt-2" />
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function AnnotationRow({ a, index, onFocus, active }: { a: Annotation; index: number; onFocus: () => void; active: boolean }) {
  const s = SEVERITY_STYLE[a.severity];
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        "group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition hover:border-zinc-300 hover:bg-zinc-50/60",
        active ? "border-indigo-300 bg-indigo-50/40" : "bg-white",
      )}
    >
      <span className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", s.pin)}>{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{a.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{a.originalText}</span>
      </span>
      <Crosshair className="mt-0.5 size-3.5 shrink-0 text-zinc-300 transition group-hover:text-zinc-500" />
    </button>
  );
}

export function InspectorPanel({
  analysis,
  activeId,
  onFocus,
  indexOf,
  onReanalyze,
  jobDescription,
  targetRole,
  fileKey,
}: {
  analysis: ResumeAnalysis;
  activeId: string | null;
  onFocus: (id: string) => void;
  indexOf: (id: string) => number;
  onReanalyze: (opts: { jobDescription?: string; targetRole?: string }) => Promise<unknown>;
  jobDescription: string;
  targetRole: string;
  fileKey: string;
}) {
  const [jd, setJd] = React.useState(jobDescription);
  const [role, setRole] = React.useState(targetRole);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setDone(new Set(readJSON<Record<string, string[]>>(KEYS.fixedItems)?.[fileKey] || []));
  }, [fileKey]);

  const toggleDone = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    const all = readJSON<Record<string, string[]>>(KEYS.fixedItems) || {};
    writeJSON(KEYS.fixedItems, { ...all, [fileKey]: [...next] });
  };

  const potential = Math.min(98, analysis.overallScore + analysis.fixes.reduce((s, f) => s + f.impact, 0));
  const projected = Math.min(98, analysis.overallScore + analysis.fixes.filter((f) => done.has(f.id)).reduce((s, f) => s + f.impact, 0));
  const impactAnns = analysis.annotations.filter((a) => a.type === "impact");
  const parserAnns = analysis.annotations.filter((a) => a.type !== "impact");

  async function rerun() {
    setRunning(true);
    try {
      await onReanalyze({ jobDescription: jd.trim() || undefined, targetRole: role.trim() || undefined });
      toast.success(jd.trim() ? "Re-scored against the job description" : "Re-scored");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <aside className="scrollbar-thin w-full shrink-0 overflow-y-auto border-t bg-white lg:w-[348px] lg:border-l lg:border-t-0">
      <Tabs defaultValue="ats" className="gap-0">
        <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur">
          <TabsList className="w-full">
            <TabsTrigger value="ats">
              <ScanSearch /> ATS
            </TabsTrigger>
            <TabsTrigger value="impact">
              <TrendingUp /> Impact
            </TabsTrigger>
            <TabsTrigger value="fixes">
              <Wrench /> Fixes
              <span className="tabular rounded bg-zinc-200/70 px-1 text-[10px]">{analysis.fixes.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ATS compatibility */}
        <TabsContent value="ats" className="space-y-6 p-4">
          <ScoreHeader label="ATS compatibility" value={analysis.scores.ats} caption="How reliably applicant-tracking software can parse your file into the right fields." />
          <div>
            <SectionTitle>Parser checks</SectionTitle>
            <ul className="divide-y rounded-lg border">
              {analysis.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  {c.status === "pass" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : c.status === "warn" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionTitle right={<Badge variant="outline" className="font-normal text-muted-foreground">{analysis.keywords.source === "job-description" ? "From job post" : analysis.keywords.family}</Badge>}>
              Keyword match
            </SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.matched.map((k) => (
                <Badge key={k} variant="success" className="font-normal">
                  {k}
                </Badge>
              ))}
              {analysis.keywords.missing.map((k) => (
                <Badge key={k} variant="outline" className="border-dashed font-normal text-zinc-500">
                  + {k}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Green = found. Dashed = commonly screened for but missing — add only what you genuinely have.</p>
          </div>

          <div className="rounded-lg border bg-zinc-50/60 p-3.5">
            <div className="mb-2 text-[13px] font-medium">Match against a specific job</div>
            <div className="grid gap-2">
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role (optional)" className="h-9 bg-white" />
              <Textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description…" className="max-h-48 min-h-24 bg-white text-[13px]" />
              <Button size="sm" variant="dark" onClick={rerun} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-score keywords
              </Button>
            </div>
          </div>

          {parserAnns.length > 0 && (
            <div>
              <SectionTitle>Parser & format flags</SectionTitle>
              <div className="grid gap-1.5">
                {parserAnns.map((a) => (
                  <AnnotationRow key={a.id} a={a} index={indexOf(a.id)} onFocus={() => onFocus(a.id)} active={a.id === activeId} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Content impact */}
        <TabsContent value="impact" className="space-y-6 p-4">
          <ScoreHeader label="Content impact" value={analysis.scores.impact} caption="How convincingly your bullets prove results to a recruiter skimming for 7 seconds." />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Quantified", value: analysis.metrics.quantifiedBullets, tone: "text-emerald-600" },
              { label: "Strong verbs", value: analysis.metrics.strongVerbBullets, tone: "text-indigo-600" },
              { label: "Passive", value: analysis.metrics.weakVerbBullets, tone: "text-rose-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-white p-3 text-center">
                <div className={cn("tabular text-xl font-semibold tracking-tight", s.tone)}>{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">Across {analysis.metrics.bulletCount} achievement bullets. Target: 60%+ quantified, 0 passive.</p>

          {(["critical", "warning", "positive"] as const).map((sev) => {
            const list = impactAnns.filter((a) => a.severity === sev);
            if (!list.length) return null;
            return (
              <div key={sev}>
                <SectionTitle>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", SEVERITY_STYLE[sev].dot)} />
                    {sev === "critical" ? "Rewrite first" : sev === "warning" ? "Strengthen" : "Keep doing this"}
                  </span>
                </SectionTitle>
                <div className="grid gap-1.5">
                  {list.map((a) => (
                    <AnnotationRow key={a.id} a={a} index={indexOf(a.id)} onFocus={() => onFocus(a.id)} active={a.id === activeId} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* Actionable fixes */}
        <TabsContent value="fixes" className="space-y-5 p-4">
          <div className="rounded-lg border bg-white p-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Projected score</span>
              <span className="tabular">
                <span className="text-lg font-semibold">{projected}</span>
                <span className="text-xs text-muted-foreground"> / potential {potential}</span>
              </span>
            </div>
            <ScoreBar value={projected} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">Tick fixes as you make them. Ordered by estimated score lift.</p>
          </div>
          <ol className="grid gap-2">
            {analysis.fixes.map((f, i) => {
              const isDone = done.has(f.id);
              const firstAnn = analysis.annotations.find((a) => f.annotationIds.includes(a.id));
              return (
                <li key={f.id} className={cn("rounded-lg border bg-white p-3 transition", isDone && "bg-zinc-50 opacity-70")}>
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleDone(f.id)}
                      className={cn(
                        "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition",
                        isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 hover:border-zinc-400",
                      )}
                      aria-label={isDone ? "Mark as not done" : "Mark as done"}
                      aria-pressed={isDone}
                    >
                      {isDone ? <CircleCheck className="size-3" /> : <span className="tabular text-[10px] text-zinc-400">{i + 1}</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[13px] font-medium", isDone && "line-through decoration-zinc-400")}>{f.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{f.detail}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant={f.priority === "high" ? "danger" : f.priority === "medium" ? "warning" : "secondary"} className="capitalize">
                          {f.priority}
                        </Badge>
                        <span className="tabular text-xs font-medium text-emerald-700">+{f.impact} pts</span>
                        {firstAnn && (
                          <div className="ml-auto flex gap-1">
                            {firstAnn.severity !== "positive" && firstAnn.suggestedText && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => copyText(firstAnn.suggestedText)}>
                                <Copy className="size-3" /> Copy
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onFocus(firstAnn.id)}>
                              <Crosshair className="size-3" /> Show
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {analysis.meta.engine === "heuristic" && (
            <p className="text-center text-[11px] text-muted-foreground">Analysed by the offline engine{analysis.meta.warnings.length ? ` · ${analysis.meta.warnings[0]}` : ""}.</p>
          )}
          {analysis.meta.engine === "llm" && (
            <p className="text-center text-[11px] text-muted-foreground">Content rewrites by {analysis.meta.model}. Parser checks are deterministic.</p>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
