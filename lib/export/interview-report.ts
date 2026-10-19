"use client";

import { jsPDF } from "jspdf";
import type { InterviewReport } from "@/lib/types";
import { INDIGO, MUTED, PdfWriter, TONES, tone } from "./pdf-kit";

export function buildInterviewReportPdf(report: InterviewReport, opts: { includeDelivery: boolean }) {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const w = new PdfWriter(doc, `CareerPrep AI · Interview evaluation · ${report.setup.role}`);
  const s = report.scores;

  w.text("CareerPrep AI", { size: 9, bold: true, color: INDIGO, gap: 2 });
  w.text("Interview Evaluation", { size: 22, bold: true, gap: 2 });
  w.text(
    `${report.setup.role} · ${report.setup.industry} · ${report.setup.level} level · ${new Date(report.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}`,
    { size: 9, color: MUTED, gap: 14 },
  );

  w.tiles([
    { label: "Overall readiness", value: `${s.overall}%`, tone: tone(s.overall) },
    { label: "Communication", value: `${s.communication}`, tone: tone(s.communication) },
    { label: "Domain competence", value: `${s.domain}`, tone: tone(s.domain) },
    { label: "Resume alignment", value: report.setup.hasResume ? `${s.alignment}` : "n/a", tone: report.setup.hasResume ? tone(s.alignment) : undefined },
  ]);
  w.text(`${report.verdict}. ${report.summary}`, { size: 10.5, gap: 10 });

  w.heading("What worked", 12);
  report.strengths.forEach((x) => w.text(`+  ${x}`, { size: 9.5, gap: 3 }));
  w.heading("Top priorities", 12);
  report.priorities.forEach((x, i) => w.text(`${i + 1}.  ${x}`, { size: 9.5, gap: 3 }));

  if (report.setup.hasResume) {
    w.heading("Resume alignment", 12);
    report.alignment.conflicts.forEach((c) => w.text(`!  ${c.note}`, { size: 9.5, color: TONES.poor, gap: 3 }));
    report.alignment.supported.forEach((x) => w.text(`Backed up: ${x.claim}`, { size: 9.5, gap: 2 }));
    report.alignment.unsupported.forEach((x) => w.text(`Not discussed: ${x}`, { size: 9.5, color: MUTED, gap: 2 }));
  }

  const d = report.delivery;
  if (report.setup.inputMode === "voice" && d.avgWpm > 0) {
    w.heading("Voice & delivery", 12);
    if (opts.includeDelivery) {
      w.tiles([
        { label: "Pace", value: `${d.avgWpm} wpm` },
        { label: "Fillers / min", value: `${d.fillerPerMin}` },
        { label: "Long pauses", value: `${d.pauses.long}` },
        { label: "Confidence", value: `${d.confidence}` },
      ]);
      d.notes.forEach((n) => w.text(`-  ${n}`, { size: 9.5, gap: 3 }));
    } else {
      w.text(`Pace: ${d.avgWpm} WPM (${d.paceLabel}). Full delivery analytics are available on Pro.`, { size: 9.5, color: MUTED });
    }
  }

  w.newPage();
  w.heading("Question-by-question replay", 16);
  report.questions.forEach((q, i) => {
    w.ensure(120);
    w.text(`Q${i + 1} · ${q.type.replace("-", " ")} · ${q.focus} · score ${q.score}/100`, { size: 8, bold: true, color: MUTED, gap: 2 });
    w.text(q.question, { size: 11, bold: true, gap: 6 });
    w.label("Your answer");
    w.text(q.answer || "(skipped)", { size: 9.5, color: MUTED, gap: 6 });
    w.label("Critique");
    w.text(q.critique, { size: 9.5, gap: 4 });
    q.improvements.forEach((x) => w.text(`->  ${x.replace(/\*/g, "")}`, { size: 9, gap: 2 }));
    w.y += 4;
    w.label("Ideal answer framework (STAR)");
    (["situation", "task", "action", "result"] as const).forEach((k) =>
      w.text(`${k[0].toUpperCase()}  ${q.idealAnswer[k]}`, { size: 9.5, gap: 2, x: w.margin + 6, width: w.contentWidth - 6 }),
    );
    w.y += 8;
    w.rule(12);
  });

  w.finish();
  return doc;
}
