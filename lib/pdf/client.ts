"use client";

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { ExtractedResume, ResumeLine } from "@/lib/types";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Lazy-load pdf.js (legacy build → widest browser support) with a same-origin worker. */
export function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      const pdfjs = mod as unknown as PdfJs;
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const loadingTasks = new WeakMap<PDFDocumentProxy, { destroy: () => Promise<void> }>();

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  // pdf.js transfers the buffer to its worker — hand it a copy so callers keep theirs.
  const task = pdfjs.getDocument({
    data: new Uint8Array(data.slice(0)),
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
  });
  const doc = await task.promise;
  loadingTasks.set(doc, task);
  return doc;
}

/** Releases the worker-side document. */
export function closePdf(doc: PDFDocumentProxy) {
  loadingTasks.get(doc)?.destroy();
  loadingTasks.delete(doc);
}

/** Renders a page into `canvas` at `cssWidth` CSS pixels, crisp on HiDPI screens. */
export function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, cssWidth: number): RenderTask {
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth / base.width) * base.height}px`;
  return page.render({ canvas, viewport });
}

interface RawItem {
  str: string;
  left: number;
  right: number;
  baseline: number;
  size: number;
}

/**
 * Pulls positioned text out of every page and groups it into visual lines.
 * Each line keeps its horizontal "segments" so the analyser can spot
 * multi-column layouts that scramble ATS reading order.
 */
export async function extractResume(doc: PDFDocumentProxy, file: { name: string; size: number }): Promise<ExtractedResume> {
  const pdfjs = await loadPdfjs();
  const lines: ResumeLine[] = [];
  const pages: ExtractedResume["pages"] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();

    const items: RawItem[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str || !it.str.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, it.transform);
      const size = Math.hypot(tx[2], tx[3]) || it.height || 10;
      items.push({ str: it.str, left: tx[4], right: tx[4] + it.width, baseline: tx[5], size });
    }

    items.sort((a, b) => a.baseline - b.baseline || a.left - b.left);

    const rows: RawItem[][] = [];
    for (const item of items) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].baseline - item.baseline) <= Math.max(2, row[0].size * 0.35)) row.push(item);
      else rows.push([item]);
    }

    rows.forEach((row, i) => {
      row.sort((a, b) => a.left - b.left);
      const segments: { left: number; text: string }[] = [];
      let prev: RawItem | null = null;
      let text = "";
      for (const item of row) {
        const gap = prev ? item.left - prev.right : 0;
        if (prev && gap > Math.max(18, item.size * 2.2)) {
          segments.push({ left: 0, text: "" });
        }
        if (!segments.length) segments.push({ left: item.left, text: "" });
        const seg = segments[segments.length - 1];
        if (!seg.text) seg.left = item.left;
        const needsSpace = seg.text && gap > item.size * 0.15 && !seg.text.endsWith(" ") && !item.str.startsWith(" ");
        seg.text += (needsSpace ? " " : "") + item.str;
        prev = item;
      }
      text = segments.map((s) => s.text.trim()).join("   ");
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean) return;

      const size = Math.max(...row.map((r) => r.size));
      const left = Math.min(...row.map((r) => r.left));
      const right = Math.max(...row.map((r) => r.right));
      const top = Math.min(...row.map((r) => r.baseline - r.size * 0.82));
      const bottom = Math.max(...row.map((r) => r.baseline + r.size * 0.24));

      lines.push({
        id: `p${p}-l${i}`,
        page: p,
        text: clean,
        x: left / viewport.width,
        y: top / viewport.height,
        w: (right - left) / viewport.width,
        h: (bottom - top) / viewport.height,
        fontSize: Math.round(size * 10) / 10,
        segments: segments.map((s) => ({ x: s.left / viewport.width, text: s.text.trim() })),
      });
    });
    page.cleanup();
  }

  return { fileName: file.name, fileSize: file.size, pageCount: doc.numPages, pages, lines };
}

export function resumePlainText(extracted: ExtractedResume) {
  return extracted.lines.map((l) => l.text).join("\n");
}
