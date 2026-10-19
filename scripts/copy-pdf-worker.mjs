// Copies pdf.js runtime assets into /public so the browser loads them from a
// stable same-origin URL (identical under Turbopack, webpack and Vercel):
//   public/pdf.worker.min.mjs        — parser worker
//   public/pdfjs/standard_fonts/     — metrics for non-embedded Helvetica/Times
//   public/pdfjs/cmaps/              — CJK and other multi-byte encodings
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules/pdfjs-dist");

if (!existsSync(pkg)) {
  console.warn("[copy-pdf-worker] pdfjs-dist not installed yet, skipping");
  process.exit(0);
}
mkdirSync(join(root, "public/pdfjs"), { recursive: true });
copyFileSync(join(pkg, "legacy/build/pdf.worker.min.mjs"), join(root, "public/pdf.worker.min.mjs"));
cpSync(join(pkg, "standard_fonts"), join(root, "public/pdfjs/standard_fonts"), { recursive: true });
cpSync(join(pkg, "cmaps"), join(root, "public/pdfjs/cmaps"), { recursive: true });
console.log("[copy-pdf-worker] pdf.js worker, fonts and cmaps copied to public/");
