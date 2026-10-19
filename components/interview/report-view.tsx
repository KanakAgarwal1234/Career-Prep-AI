"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Download,
  Gauge,
  Loader2,
  Lock,
  MessageSquareQuote,
  Mic,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreBar, ScoreRing } from "@/components/shared/score-ring";
import { useApp } from "@/components/providers/app-provider";
import type { InterviewReport, QuestionReview } from "@/lib/types";
import { cn, scoreTone } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionReview["type"], string> = {
  opener: "Opener",
  behavioral: "Behavioral",
  technical: "Role-specific",
  situational: "Situational",
  resume: "Resume deep-dive",
  "follow-up": "Follow-up",
  closing: "Closing",
};

function toneBadge(score: number) {
  const t = scoreTone(score);
  return t === "good" ? "success" : t === "fair" ? "warning" : "danger";
}

function Card({ title, icon: Icon, children, className, right }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-white p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Icon className="size-4 text-zinc-500" /> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function ScoreTile({ label, value, hint, na }: { label: string; value: number; hint: string; na?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold tracking-tight">{na ? "—" : value}</span>
        {!na && (
          <Badge variant={toneBadge(value)} className="font-normal">
            {value >= 75 ? "Strong" : value >= 55 ? "Developing" : "Gap"}
          </Badge>
        )}
      </div>
      {!na && <ScoreBar value={value} className="mt-3" />}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Pace gauge: 90–210 WPM track, ideal 130–165 band, marker at the measured pace. */
function PaceGauge({ wpm }: { wpm: number }) {
  const min = 90;
  const max = 210;
  const pos = (v: number) => `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-zinc-100">
        <div className="absolute inset-y-0 rounded-full bg-emerald-200" style={{ left: pos(130), width: `calc(${pos(165)} - ${pos(130)})` }} title="Ideal: 130–165 WPM" />
        {wpm > 0 && (
          <motion.div
            initial={{ left: pos(min) }}
            animate={{ left: pos(wpm) }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-2 ring-white"
            title={`${wpm} WPM`}
          />
        )}
      </div>
      <div className="tabular mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{min}</span>
        <span className="text-zinc-600">ideal 130–165</span>
        <span>{max}+</span>
      </div>
    </div>
  );
}

function Bars({ items, max }: { items: { label: string; value: number; hint?: string }[]; max: number }) {
  return (
    <div className="grid gap-2">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[88px_1fr_28px] items-center gap-3 text-[13px]" title={it.hint ? `${it.label}: ${it.value} (${it.hint})` : `${it.label}: ${it.value}`}>
          <span className="truncate text-zinc-600">{it.label}</span>
          <div className="h-3 rounded-r-[4px] bg-zinc-50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${max ? (it.value / max) * 100 : 0}%` }}
              transition={{ duration: 0.7 }}
              className="h-full rounded-r-[4px] bg-indigo-500"
              style={{ minWidth: it.value ? 4 : 0 }}
            />
          </div>
          <span className="tabular text-right font-medium text-zinc-900">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function Locked({ children, locked, onUnlock }: { children: React.ReactNode; locked: boolean; onUnlock: () => void }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/40 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-zinc-900 text-white">
          <Lock className="size-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">Full delivery analytics are part of Pro</div>
          <div className="text-xs text-muted-foreground">Filler words, pause distribution, response latency and tone confidence.</div>
        </div>
        <Button size="sm" onClick={onUnlock}>
          <Sparkles /> Unlock Pro
        </Button>
      </div>
    </div>
  );
}

function StarChips({ star }: { star: QuestionReview["star"] }) {
  return (
    <div className="flex gap-1" aria-label="STAR coverage">
      {(["situation", "task", "action", "result"] as const).map((k) => (
        <span
          key={k}
          title={`${k[0].toUpperCase() + k.slice(1)}: ${star[k] ? "covered" : "missing"}`}
          className={cn(
            "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium",
            star[k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-dashed text-zinc-400",
          )}
        >
          {star[k] ? <CheckCircle2 className="size-3" /> : <CircleDashed className="size-3" />}
          {k[0].toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function QuestionItem({ q, i, open, onToggle }: { q: QuestionReview; i: number; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-xl border bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left sm:p-5" aria-expanded={open}>
        <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold">{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={q.type === "follow-up" ? "indigo" : "outline"} className="font-normal">
              {TYPE_LABEL[q.type]}
            </Badge>
            <span>{q.focus}</span>
          </div>
          <p className="text-[14px] font-medium leading-snug">{q.question}</p>
          {!open && <p className="mt-1.5 line-clamp-1 text-[13px] text-muted-foreground">{q.critique}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={toneBadge(q.score)} className="tabular">
            {q.score}
          </Badge>
          <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden border-t">
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
            <div className="grid content-start gap-4">
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your answer</div>
                <p className="scrollbar-thin max-h-60 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-700">{q.answer || <em>Skipped</em>}</p>
                {q.metrics.wpm > 0 && (
                  <div className="tabular mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{q.metrics.wpm} WPM</span>
                    <span>{q.metrics.words} words</span>
                    <span>{q.metrics.speakingSec}s speaking</span>
                    <span>{q.metrics.fillerCount} fillers</span>
                    <span>{q.metrics.pauses.long} long pauses</span>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Coach&apos;s critique</span>
                  <StarChips star={q.star} />
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-800">{q.critique}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {q.strengths.length > 0 && (
                    <ul className="grid gap-1.5">
                      {q.strengths.map((s) => (
                        <li key={s} className="flex gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.improvements.length > 0 && (
                    <ul className="grid gap-1.5">
                      {q.improvements.map((s) => (
                        <li key={s} className="flex gap-2 text-xs text-zinc-700">
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-amber-500" /> {s.replace(/\*/g, "")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-indigo-700">
                <Target className="size-3.5" /> Ideal answer framework · STAR
              </div>
              <ol className="grid gap-3">
                {(["situation", "task", "action", "result"] as const).map((k) => (
                  <li key={k} className="grid grid-cols-[22px_1fr] gap-2">
                    <span className="flex size-[22px] items-center justify-center rounded-md bg-white text-[11px] font-semibold text-indigo-700 shadow-xs">{k[0].toUpperCase()}</span>
                    <div>
                      <div className="text-xs font-medium capitalize text-zinc-900">{k}</div>
                      <p className="text-[13px] leading-relaxed text-zinc-700">{q.idealAnswer[k]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.div>
      )}
    </li>
  );
}

export function ReportView({ report }: { report: InterviewReport }) {
  const { plan, openUpgrade } = useApp();
  const [open, setOpen] = React.useState<number | null>(0);
  const [exporting, setExporting] = React.useState(false);
  const s = report.scores;
  const d = report.delivery;
  const trial = report.setup.plan === "trial" && plan !== "pro";
  const voice = report.setup.inputMode === "voice" && d.avgWpm > 0;
  const fillerItems = Object.entries(d.fillers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label: `“${label}”`, value }));

  async function exportPdf() {
    setExporting(true);
    try {
      const { buildInterviewReportPdf } = await import("@/lib/export/interview-report");
      const doc = buildInterviewReportPdf(report, { includeDelivery: !trial });
      doc.save(`interview-evaluation-${report.setup.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't export the PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* heading */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {report.setup.plan === "pro" ? "Full interview" : "Free trial"} · {report.questions.length} questions
            </Badge>
            <Badge variant="outline" className="font-normal">
              {report.setup.inputMode === "voice" ? <Mic /> : null}
              {report.setup.inputMode === "voice" ? "Voice" : "Typed"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Interview evaluation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.setup.role} · {report.setup.industry} · {new Date(report.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/interview">
              <RotateCcw /> Practice again
            </Link>
          </Button>
          <Button onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export PDF
          </Button>
        </div>
      </div>

      {/* executive scorecard */}
      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center rounded-xl border bg-white p-6 text-center">
          <ScoreRing value={s.overall} size={168} stroke={11} label="Readiness" />
          <Badge variant={toneBadge(s.overall)} className="mt-4">
            {report.verdict}
          </Badge>
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">{report.summary}</p>
        </motion.div>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreTile label="Communication" value={s.communication} hint="Clarity, concision, structure and delivery." />
            <ScoreTile label="Domain competence" value={s.domain} hint="Depth of role-specific reasoning and vocabulary." />
            <ScoreTile
              label="Resume alignment"
              value={s.alignment}
              na={!report.setup.hasResume}
              hint={report.setup.hasResume ? "Did your answers back up your resume claims?" : "Add a resume to verify claims next time."}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                <CheckCircle2 className="size-4 text-emerald-500" /> What worked
              </div>
              <ul className="grid gap-2">
                {report.strengths.map((x) => (
                  <li key={x} className="text-[13px] leading-relaxed text-zinc-700">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                <Target className="size-4 text-indigo-600" /> Top priorities
              </div>
              <ol className="grid gap-2">
                {report.priorities.map((x, i) => (
                  <li key={x} className="flex gap-2 text-[13px] leading-relaxed text-zinc-700">
                    <span className="tabular font-semibold text-zinc-400">{i + 1}</span> {x}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* resume alignment */}
        <Card title="Resume alignment" icon={MessageSquareQuote} right={report.setup.hasResume ? <Badge variant={toneBadge(s.alignment)}>{s.alignment}/100</Badge> : null}>
          {!report.setup.hasResume ? (
            <p className="text-sm text-muted-foreground">
              No resume was attached, so claims couldn&apos;t be cross-checked. <Link href="/review" className="font-medium text-indigo-700 hover:underline">Run an ATS audit</Link> and it carries over automatically.
            </p>
          ) : (
            <div className="grid gap-4">
              {report.alignment.conflicts.map((c) => (
                <div key={c.claim} className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                  <div>
                    <div className="text-[13px] font-medium">Inconsistent with resume</div>
                    <p className="text-xs leading-relaxed text-zinc-600">{c.note}</p>
                  </div>
                </div>
              ))}
              {report.alignment.supported.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Backed up in your answers</div>
                  <ul className="grid gap-2">
                    {report.alignment.supported.map((x) => (
                      <li key={x.claim} className="flex gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-snug">{x.claim}</p>
                          {x.evidence && <p className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">“{x.evidence}”</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.alignment.unsupported.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Never came up — prepare a story</div>
                  <ul className="grid gap-2">
                    {report.alignment.unsupported.map((c) => (
                      <li key={c} className="flex gap-2.5 text-[13px] leading-snug text-zinc-600">
                        <CircleDashed className="mt-0.5 size-4 shrink-0 text-zinc-400" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* voice & delivery */}
        <Card title="Voice & delivery" icon={Gauge} right={voice ? <Badge variant={toneBadge(s.delivery)}>{s.delivery}/100</Badge> : null}>
          {!voice ? (
            <p className="text-sm text-muted-foreground">Delivery analytics are measured from your voice. Choose “Speaking” on your next run to get pace, pauses and filler-word tracking.</p>
          ) : (
            <div className="grid gap-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-medium">Pace</span>
                  <span className="text-sm">
                    <span className="tabular text-lg font-semibold">{d.avgWpm}</span> <span className="text-muted-foreground">WPM · {d.paceLabel}</span>
                  </span>
                </div>
                <PaceGauge wpm={d.avgWpm} />
              </div>
              <Locked locked={trial} onUnlock={() => openUpgrade("Unlock full voice & delivery analytics.")}>
                <div className="grid gap-5">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Fillers / min", value: d.fillerPerMin.toString(), sub: `${d.fillerTotal} total` },
                      { label: "Avg. latency", value: `${d.avgLatencySec}s`, sub: "to first word" },
                      { label: "Confidence", value: `${d.confidence}`, sub: d.confidenceLabel },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg border p-3">
                        <div className="text-[11px] text-muted-foreground">{m.label}</div>
                        <div className="tabular text-lg font-semibold tracking-tight">{m.value}</div>
                        <div className="text-[11px] text-muted-foreground">{m.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[13px] font-medium">Pause distribution</div>
                      <Bars
                        max={Math.max(1, d.pauses.short, d.pauses.medium, d.pauses.long)}
                        items={[
                          { label: "1–2s", value: d.pauses.short, hint: "natural" },
                          { label: "2–4s", value: d.pauses.medium, hint: "noticeable" },
                          { label: "4s+", value: d.pauses.long, hint: "reads as uncertainty" },
                        ]}
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-[13px] font-medium">Filler words</div>
                      {fillerItems.length ? <Bars max={fillerItems[0].value} items={fillerItems} /> : <p className="text-xs text-muted-foreground">None detected.</p>}
                    </div>
                  </div>
                  <ul className="grid gap-1.5 border-t pt-4">
                    {d.notes.map((n) => (
                      <li key={n} className="flex gap-2 text-[13px] leading-relaxed text-zinc-700">
                        <ArrowRight className="mt-1 size-3.5 shrink-0 text-zinc-400" /> {n}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">Note: some browsers' speech recognition drops “um/uh”, so filler counts may read low.</p>
                </div>
              </Locked>
            </div>
          )}
        </Card>
      </div>

      {/* replay */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Question-by-question replay</h2>
          <span className="text-xs text-muted-foreground">Click a question to expand</span>
        </div>
        <ol className="grid gap-2">
          {report.questions.map((q, i) => (
            <QuestionItem key={q.questionId + i} q={q} i={i} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </ol>
      </section>

      {trial && (
        <section className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-[15px] font-semibold">Ready for the full interview?</h3>
            <p className="mt-1 text-sm text-zinc-600">Pro runs 7 adaptive questions with follow-up drill-downs and complete delivery analytics.</p>
          </div>
          <Button onClick={() => openUpgrade()}>
            <Sparkles /> Upgrade to Pro
          </Button>
        </section>
      )}

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        {report.meta.engine === "llm" ? `Critique by ${report.meta.model}. Delivery metrics are measured, not generated.` : "Scored by the offline engine. Add an AI key for richer, tailored critique."}
        {report.meta.warnings.length ? ` · ${report.meta.warnings[0]}` : ""}
      </p>
    </div>
  );
}
