"use client";

import { jsPDF } from "jspdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ResumeAnalysis, Severity } from "@/lib/types";
import { scoreLabel } from "@/lib/utils";
import { INDIGO, MUTED, PdfWriter, TONES, latin, tone } from "./pdf-kit";

const SEV_RGB: Record<Severity, [number, number, number]> = {
  critical: [244, 63, 94],
  warning: [245, 158, 11],
  positive: [16, 185, 129],
};
const SEV_LABEL: Record<Severity, string> = { critical: "Red flag", warning: "Improve", positive: "Green flag" };

/** Renders a resume page with its highlights + numbered pins burned in. */
async function annotatedPageImage(doc: PDFDocumentProxy, pageNo: number, analysis: ResumeAnalysis, order: Map<string, number>) {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;

  for (const a of analysis.annotations.filter((x) => x.page === pageNo)) {
    const [r, g, b] = SEV_RGB[a.severity];
    const x = a.x * canvas.width;
    const y = a.y * canvas.height;
    const w = a.width * canvas.width;
    const h = Math.max(a.height * canvas.height, 18);
    ctx.fillStyle = `rgba(${r},${g},${b},0.10)`;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.75)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    const n = (order.get(a.id) ?? 0) + 1;
    const cx = Math.max(x - 22, 16);
    const cy = y + h / 2;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), cx, cy + 1);
  }
  return { data: canvas.toDataURL("image/jpeg", 0.86), ratio: canvas.height / canvas.width };
}

export async function buildResumeReportPdf(source: PDFDocumentProxy, analysis: ResumeAnalysis, fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const w = new PdfWriter(doc, `CareerPrep AI · ATS audit · ${fileName}`);
  const ordered = [...analysis.annotations].sort((a, b) => a.page - b.page || a.y - b.y);
  const order = new Map(ordered.map((a, i) => [a.id, i]));

  // ---- Cover summary -------------------------------------------------------
  w.text("CareerPrep AI", { size: 9, bold: true, color: INDIGO, gap: 2 });
  w.text("ATS Audit Report", { size: 22, bold: true, gap: 2 });
  w.text(`${fileName} · ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`, { size: 9, color: MUTED, gap: 14 });

  const s = analysis.scores;
  w.tiles([
    { label: "Overall", value: `${analysis.overallScore}`, tone: tone(analysis.overallScore) },
    { label: "ATS parsing", value: `${s.ats}`, tone: tone(s.ats) },
    { label: "Content impact", value: `${s.impact}`, tone: tone(s.impact) },
    { label: "Keywords", value: `${s.keywords}`, tone: tone(s.keywords) },
  ]);
  w.text(`${scoreLabel(analysis.overallScore)}. ${analysis.summary}`, { size: 10.5, gap: 10 });

  const m = analysis.metrics;
  w.tiles([
    { label: "Quantified bullets", value: `${m.quantifiedImpactPct}%` },
    { label: "Formatting risk", value: m.formattingRisk.toUpperCase() },
    { label: "Keyword density", value: `${m.keywordDensityPct}%` },
  ]);

  w.heading("Parser checks", 12);
  for (const c of analysis.checks) {
    const mark = c.status === "pass" ? "PASS" : c.status === "warn" ? "WARN" : "FAIL";
    const color = c.status === "pass" ? TONES.good : c.status === "warn" ? TONES.fair : TONES.poor;
    w.ensure(16);
    const y = w.y;
    w.text(mark, { size: 7.5, bold: true, color, gap: 0, width: 40 });
    w.y = y;
    w.text(`${c.label} — ${c.detail}`, { size: 9.5, x: w.margin + 40, width: w.contentWidth - 40, gap: 3 });
  }

  w.heading("Keywords", 12);
  w.text(`Found: ${analysis.keywords.matched.join(", ") || "—"}`, { size: 9.5, gap: 3 });
  w.text(`Missing: ${analysis.keywords.missing.join(", ") || "—"}`, { size: 9.5, color: MUTED, gap: 8 });

  // ---- Annotated pages -----------------------------------------------------
  for (let p = 1; p <= source.numPages; p++) {
    w.newPage();
    w.text(`Annotated page ${p}`, { size: 12, bold: true, gap: 8 });
    const img = await annotatedPageImage(source, p, analysis, order);
    const maxH = w.height - w.y - w.margin - 10;
    let iw = w.contentWidth;
    let ih = iw * img.ratio;
    if (ih > maxH) {
      ih = maxH;
      iw = ih / img.ratio;
    }
    const x = w.margin + (w.contentWidth - iw) / 2;
    doc.setDrawColor(228, 228, 231);
    doc.rect(x - 0.5, w.y - 0.5, iw + 1, ih + 1);
    doc.addImage(img.data, "JPEG", x, w.y, iw, ih);
    w.y += ih + 10;
  }

  // ---- Annotation detail ---------------------------------------------------
  w.newPage();
  w.heading("Line-by-line notes", 16);
  ordered.forEach((a, i) => {
    w.ensure(70);
    const [r, g, b] = SEV_RGB[a.severity];
    doc.setFillColor(r, g, b);
    doc.circle(w.margin + 7, w.y + 7, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), w.margin + 7, w.y + 9.8, { align: "center" });
    const top = w.y;
    w.text(`${a.title}  ·  ${SEV_LABEL[a.severity]} · ${a.type.toUpperCase()} · page ${a.page}`, { size: 10.5, bold: true, x: w.margin + 22, width: w.contentWidth - 22, gap: 2 });
    if (w.y < top + 16) w.y = top + 16;
    w.text(a.note, { size: 9.5, color: MUTED, x: w.margin + 22, width: w.contentWidth - 22, gap: 4 });
    if (a.severity !== "positive") {
      w.text(`Original: ${a.originalText}`, { size: 9, x: w.margin + 22, width: w.contentWidth - 22, color: MUTED, gap: 2 });
      w.text(`Suggested: ${a.suggestedText}`, { size: 9.5, bold: true, x: w.margin + 22, width: w.contentWidth - 22, gap: 10 });
    } else {
      w.text(`"${a.originalText}"`, { size: 9.5, x: w.margin + 22, width: w.contentWidth - 22, gap: 10 });
    }
  });

  // ---- Fix plan ------------------------------------------------------------
  w.heading("Fix plan", 16);
  analysis.fixes.forEach((f, i) => {
    w.ensure(36);
    w.text(`${i + 1}. ${f.title}   (+${f.impact} pts, ${f.priority} priority)`, { size: 10.5, bold: true, gap: 1 });
    w.text(f.detail, { size: 9.5, color: MUTED, x: w.margin + 12, width: w.contentWidth - 12, gap: 8 });
  });
  w.text(latin("Numbers in [brackets] are placeholders — replace them with your real results before sending."), { size: 8.5, color: MUTED, gap: 0 });

  w.finish();
  return doc;
}
