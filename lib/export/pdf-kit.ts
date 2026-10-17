"use client";

import type { jsPDF as JsPDF } from "jspdf";

/** jsPDF's built-in Helvetica is Latin-1 only — normalise typographic characters. */
export function latin(text: string) {
  return text
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[•·●▪]/g, "-")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

export const INK: [number, number, number] = [24, 24, 27];
export const MUTED: [number, number, number] = [113, 113, 122];
export const RULE: [number, number, number] = [228, 228, 231];
export const INDIGO: [number, number, number] = [67, 56, 202];
export const TONES = {
  good: [16, 185, 129] as [number, number, number],
  fair: [245, 158, 11] as [number, number, number],
  poor: [244, 63, 94] as [number, number, number],
};

/** Minimal flowing-layout writer on top of jsPDF: cursor, wrapping and page breaks. */
export class PdfWriter {
  doc: JsPDF;
  y: number;
  readonly margin = 54;
  readonly width: number;
  readonly height: number;
  private footer: string;

  constructor(doc: JsPDF, footer: string) {
    this.doc = doc;
    this.width = doc.internal.pageSize.getWidth();
    this.height = doc.internal.pageSize.getHeight();
    this.y = this.margin;
    this.footer = footer;
  }

  get contentWidth() {
    return this.width - this.margin * 2;
  }

  ensure(space: number) {
    if (this.y + space > this.height - this.margin) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = this.margin;
  }

  text(content: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number; width?: number; gap?: number; lineHeight?: number } = {}) {
    const { size = 10, bold = false, color = INK, x = this.margin, width = this.contentWidth, gap = 4, lineHeight = 1.4 } = opts;
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(latin(content), width) as string[];
    const lh = size * lineHeight;
    for (const line of lines) {
      this.ensure(lh);
      this.doc.text(line, x, this.y + size);
      this.y += lh;
    }
    this.y += gap;
  }

  label(content: string) {
    this.text(content.toUpperCase(), { size: 7.5, bold: true, color: MUTED, gap: 2 });
  }

  heading(content: string, size = 14) {
    this.ensure(size * 3);
    this.y += 6;
    this.text(content, { size, bold: true, gap: 6 });
  }

  rule(gap = 10) {
    this.ensure(gap * 2);
    this.doc.setDrawColor(...RULE);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.margin, this.y, this.width - this.margin, this.y);
    this.y += gap;
  }

  /** Row of score tiles. */
  tiles(items: { label: string; value: string; tone?: keyof typeof TONES }[]) {
    const gap = 8;
    const w = (this.contentWidth - gap * (items.length - 1)) / items.length;
    const h = 52;
    this.ensure(h + 10);
    items.forEach((it, i) => {
      const x = this.margin + i * (w + gap);
      this.doc.setDrawColor(...RULE);
      this.doc.setFillColor(250, 250, 250);
      this.doc.roundedRect(x, this.y, w, h, 6, 6, "FD");
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...MUTED);
      this.doc.text(latin(it.label.toUpperCase()), x + 10, this.y + 16);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(17);
      this.doc.setTextColor(...(it.tone ? TONES[it.tone] : INK));
      this.doc.text(latin(it.value), x + 10, this.y + 40);
    });
    this.y += h + 14;
  }

  finish() {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...MUTED);
      this.doc.text(latin(this.footer), this.margin, this.height - 28);
      this.doc.text(`${i} / ${pages}`, this.width - this.margin, this.height - 28, { align: "right" });
    }
  }
}

export function tone(score: number): keyof typeof TONES {
  return score >= 75 ? "good" : score >= 55 ? "fair" : "poor";
}
