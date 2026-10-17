// Smoke test: extracts the sample resume with pdf.js in Node and prints the offline audit.
//   npm run smoke:analyze [-- path/to/resume.pdf] [--lines]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadPdfjs, openPdf, extractResume } from "../lib/pdf/client";
import { analyzeResumeHeuristic } from "../lib/resume/analyze";

const pdfjs = await loadPdfjs();
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(process.cwd() + "/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs").href;
const file = process.argv.slice(2).find((a) => !a.startsWith("--")) || "public/sample-resume.pdf";
const buf = readFileSync(file);
const doc = await openPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const ex = await extractResume(doc, { name: "sample.pdf", size: buf.length });
if (process.argv.includes("--lines")) for (const l of ex.lines) console.log(l.id, l.fontSize, l.segments.length, JSON.stringify(l.text).slice(0, 110));
const a = analyzeResumeHeuristic(ex, {});
console.log(JSON.stringify({ overall: a.overallScore, scores: a.scores, metrics: a.metrics, kw: a.keywords, summary: a.summary }, null, 1));
for (const an of a.annotations) console.log(`[${an.severity}/${an.type}] ${an.title} @(${an.x.toFixed(2)},${an.y.toFixed(2)}) :: ${an.originalText.slice(0, 70)}\n    -> ${an.suggestedText.slice(0, 140)}`);
console.log(a.checks.map((c) => `${c.status} ${c.label}: ${c.detail}`).join("\n"));
console.log(a.fixes.map((f) => `${f.priority} +${f.impact} ${f.title}`).join("\n"));
