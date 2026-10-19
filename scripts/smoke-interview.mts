// Smoke test: simulates a Pro interview against the sample resume with the offline
// planner + scorer and prints the questions asked and the resulting report.
//   npm run smoke:interview
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadPdfjs, openPdf, extractResume, resumePlainText } from "../lib/pdf/client";
import { buildResumeProfile } from "../lib/resume/profile";
import { nextQuestionOffline } from "../lib/interview/planner";
import { computeDelivery } from "../lib/interview/delivery";
import { evaluateInterviewHeuristic } from "../lib/interview/evaluate";
import type { InterviewSetup, InterviewTurn } from "../lib/types";

const pdfjs = await loadPdfjs();
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(process.cwd() + "/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs").href;
const buf = readFileSync("public/sample-resume.pdf");
const doc = await openPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const ex = await extractResume(doc, { name: "s.pdf", size: buf.length });
const profile = buildResumeProfile(resumePlainText(ex), "ats-audit", "s.pdf");
console.log("PROFILE", JSON.stringify({ ...profile, text: profile.text.length }, null, 1));

const setup: InterviewSetup = { sessionId: "sess_test1", role: "Senior Product Manager", industry: "Healthcare", level: "senior", resume: profile, plan: "pro", inputMode: "voice" };
const answers = [
  "I'm a product manager with seven years of experience, most recently at Lumen Health where I led onboarding. I love turning messy problems into simple products, and this role is a great fit because you're scaling a B2B platform.",
  "Sure. We redesigned onboarding. It went well and um, like, the team was happy.",
  "So at Lumen Health the situation was that activation was flat. My goal was to raise activation. I interviewed 20 users, I mapped the funnel in SQL, and I proposed cutting two steps. As a result activation increased 20% in one quarter.",
  "We had a disagreement with engineering about scope. We talked about it and we agreed and we shipped and our team was aligned and we moved on.",
  "I personally drafted the scope doc and I ran the prioritization workshop with the tech lead, then I made the call to cut the reporting feature.",
  "First I would check if it's a tracking issue, then segment by platform and version, then look at recent releases. The trade-off is speed versus accuracy, because it depends on whether the drop is real.",
  "I want this role because I'm passionate about healthcare products and I think I could make a real impact in the first year by shipping faster.",
];
const history: InterviewTurn[] = [];
for (let i = 0; i < 8; i++) {
  const r = nextQuestionOffline(setup, history, "pro");
  if (r.done) { console.log("DONE:", r.closing); break; }
  console.log(`Q${i + 1} [${r.question!.type}/${r.question!.focus}] ${r.ack ? "(" + r.ack + ") " : ""}${r.question!.text}`);
  const answer = answers[i] || "";
  const t0 = 0;
  history.push({ question: r.question!, answer, metrics: computeDelivery(answer, { listenStart: t0, submittedAt: 40000, firstVoiceAt: 1500, lastVoiceAt: 1500 + answer.split(" ").length * 380, pauses: [1200, 2600, 4500], sttConfidence: 0.9 }) });
}
const rep = evaluateInterviewHeuristic(setup, history);
console.log(JSON.stringify({ scores: rep.scores, verdict: rep.verdict, summary: rep.summary, strengths: rep.strengths, priorities: rep.priorities, alignment: rep.alignment, delivery: rep.delivery }, null, 1));
for (const q of rep.questions) console.log(q.score, q.type, "|", q.critique);
const trial = { ...setup, plan: "trial" as const };
const th: InterviewTurn[] = [];
for (let i = 0; i < 4; i++) { const r = nextQuestionOffline(trial, th, "trial"); if (r.done) { console.log("TRIAL DONE at", i); break; } console.log("T", r.question!.type, r.question!.text.slice(0, 80)); th.push({ question: r.question!, answer: answers[i], metrics: computeDelivery(answers[i], null) }); }
