# CareerPrep AI

Two career tools in one Next.js app:

1. **Visual ATS Audit (free).** Upload a PDF resume. The page renders in the centre of the screen, and every red flag, green flag and rewrite is pinned to the exact line it refers to, with highlight boxes, numbered pins, curved arrows and margin callouts. Click any annotation to get the suggested rewrite and a **Copy Improved Wording** button.
2. **Adaptive AI Mock Interview (Pro, with a free 3-question trial).** A voice interviewer reads each question aloud, transcribes your answer as you speak, asks follow-ups when an answer is vague, and checks your answers against the claims on your resume. At the end you get a full report: an executive scorecard, resume alignment, voice and delivery analytics (pace, pauses, filler words), a question-by-question replay with STAR "ideal answer" outlines, and a PDF export.

**It runs fully offline with zero API keys.** With no keys set, a rule-based ATS engine, a rule-based interviewer, browser speech, local demo accounts and a mock Stripe checkout cover every screen. Each key you add swaps one of these for the real service.

---

## Quick start

```bash
cd careerprep-ai
npm install          # postinstall copies the pdf.js worker, fonts and cmaps into /public
npm run dev          # http://localhost:3000
```

### Go live (Supabase + Stripe + Vercel)

Run this once **on your own machine**, from `careerprep-ai/`:

```bash
npm run setup
```

It asks for each key one at a time (secrets are hidden while you type) and then:

1. writes `careerprep-ai/.env.local` (git-ignored, owner-only permissions)
2. pushes the database schema to Supabase (`supabase db push`, applying `supabase/migrations/`)
3. creates or updates the Vercel project with **Root Directory = `careerprep-ai`**, uploads every env var and deploys
4. creates the Stripe Pro price (if you don't have one) and the webhook, and points Supabase Auth's redirect URLs at your production domain

It's safe to re-run: press Enter to keep a value you already entered. Tokens it only needs once (Vercel, Supabase access token, database URL) are never saved.

Only want the schema? From the repo root:

```bash
npx -y supabase@2.121.0 db push --workdir careerprep-ai --db-url "<Supabase → Connect → Session pooler URI>"
```

(Percent-encode the password if it contains `@ # / ?`; `npm run setup` does this for you.)

Click **Try a sample resume** on `/review` to see the audit on a resume with deliberate flaws (`public/sample-resume.pdf`, regenerate with `npm run sample-resume`).

| Script | What it does |
|---|---|
| `npm run setup` | One-time keys + Supabase schema + Vercel + Stripe wiring (see above) |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke:analyze [-- file.pdf] [--lines]` | Runs the offline ATS engine on a PDF from the terminal |
| `npm run smoke:interview` | Simulates a Pro interview with the offline planner and scorer |

## Stack

Next.js 16 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · shadcn/ui-style components (Radix) · Lucide · Framer Motion · pdf.js · Vercel AI SDK (OpenAI / Anthropic) · Web Speech API, with optional OpenAI TTS/Whisper and ElevenLabs · Supabase (Auth, Postgres, Storage) · Stripe Checkout · jsPDF

## Configuration

Every variable is optional. See [`.env.example`](.env.example).

| Capability | Variables | Without them |
|---|---|---|
| LLM critique and rewrites | `OPENAI_API_KEY` (default `gpt-4o`) or `ANTHROPIC_API_KEY` (default `claude-sonnet-5-5`), optional `AI_PROVIDER`, `*_MODEL` | Rule-based engines |
| HD interviewer voice | `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` | Browser `speechSynthesis` |
| Speech-to-text fallback (for Firefox and similar) | `OPENAI_API_KEY` (Whisper) | Typed answers |
| Auth, storage, history, server-checked Pro plan | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Local demo accounts |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Mock checkout that grants Pro instantly |

**Supabase:** the schema lives in [`supabase/migrations/`](supabase/migrations/) (applied by `npm run setup`). It creates the `profiles`, `resume_reviews` and `interviews` tables, row-level security, a trigger that creates a profile for each new user, and a private `resumes` storage bucket. Users can't change their own `plan`; only the server can, using the service role.

**Stripe:** `npm run setup` creates the recurring price and the webhook (`/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). To do it by hand, set `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` yourself.

## How it works

### Part 1: Visual ATS audit

1. pdf.js renders each page to a `<canvas>` (sharp on high-DPI screens) **and** extracts positioned text in the browser. Text pieces are grouped into lines, and each line keeps its horizontal segments, which is how the engine spots multi-column layouts.
2. `POST /api/analyze-resume` receives those lines and returns annotations whose coordinates are relative to the page (0–1). That makes them line up with the canvas at any zoom level.
3. The engine runs layout and parsing checks that are always deterministic: side-by-side columns, unusual bullet characters, icon-font characters, text under 8pt, mixed date formats, missing contact details or section headings, and keyword match against a role profile or a pasted job post. It also scores content: passive openers, missing metrics, first-person pronouns, overly long bullets and buzzwords. When an LLM key is set, the content annotations are rewritten by the model. Layout checks stay rule-based because a model can't see page geometry.
4. The overlay draws highlight boxes, numbered pins and margin callouts. As many callouts are shown as fit beside the page, red flags first. Curved SVG arrows connect each callout to its line. Arrow keys step through annotations.

### Part 2: Mock interview

- **Planner** (`lib/interview/planner.ts`): a fixed plan per session (seeded by session ID): opener → resume-claim check → behavioral → role-specific → situational → role-specific → closing. On Pro, up to 2 follow-ups are inserted when an answer is too short, says "we" far more than "I", has no measurable result, skips trade-offs, or uses a different number from the resume. With an LLM key, the model writes the next question under the same rules.
- **Speech:** browser speech recognition shows live transcripts. The microphone's audio level drives a voice-activity detector, which measures **pace (WPM), pauses (1–2s / 2–4s / 4s+) and response latency** more reliably than transcript timestamps. Filler and hedge words are counted from the transcript.
- **Scoring** (`POST /api/interview/evaluate`): overall readiness, communication, domain competence, resume alignment (claims you backed up, claims never mentioned, numbers that don't match the resume), delivery, STAR coverage for each answer, critique, and an ideal-answer outline. Delivery metrics are always measured, never generated by the LLM.

### Paywall

- The ATS audit needs no account. Saving or downloading the full report asks the user to sign in.
- The interview server limits each session to **3 questions on trial and 7 on Pro**. With Supabase configured, the plan comes only from `profiles.plan`, read with the service role after Supabase Auth verifies the caller's access token. Headers, cookies and localStorage are ignored, and if the service-role key is missing every caller is treated as trial. Checkout takes the buyer from the verified token, never from the request body.
- In demo mode (no Supabase at all), the browser's own `x-cp-plan` header is honoured so the paywall can be tried offline.
- On trial, the delivery deep-dive is blurred behind an upgrade prompt, and the upgrade button opens Stripe Checkout.

## API

| Route | Body → Response |
|---|---|
| `POST /api/analyze-resume` | `{ resume: ExtractedResume, jobDescription?, targetRole? }` → `{ overallScore, scores, metrics, keywords, checks, annotations: [{ page, x, y, width, height, type: 'ats'\|'impact'\|'format', severity, title, originalText, suggestedText, note }], fixes, summary, meta }` |
| `POST /api/interview/next` | `{ setup, history: [{ question, answer, metrics }] }` → `{ done, question?, ack?, closing?, index, total }` |
| `POST /api/interview/evaluate` | `{ setup, history }` → `InterviewReport` |
| `POST /api/tts` | `{ text }` → `audio/mpeg` (returns 501 when no provider is set) |
| `POST /api/transcribe` | multipart `audio` → `{ text }` |
| `POST /api/checkout` · `GET /api/checkout/verify` · `POST /api/stripe/webhook` | Stripe Checkout lifecycle |
| `GET /api/capabilities` | Which optional integrations are configured |

Types live in [`lib/types.ts`](lib/types.ts).

## Project layout

```
app/                     routes: / · /review · /interview · /interview/report · /pricing · /checkout/success · api/*
components/review/       document stage (canvas + overlays), annotation card, score sidebar, inspector
components/interview/    setup, mic check, chamber, voice orb, report
components/ui/           shadcn-style primitives
lib/resume/              offline ATS engine, rewrite templates, word lists, resume profiler
lib/interview/           question bank, adaptive planner, answer analysis, delivery metrics, scorer
lib/ai/                  model selection + LLM upgrades (resume, next question, evaluation)
lib/speech/              TTS, live transcription, mic level + voice activity
lib/export/              jsPDF report builders
scripts/setup.mjs        one-time go-live setup (npm run setup)
supabase/migrations/     tables, RLS, storage bucket
```

## Deploying to Vercel

This app lives in a subfolder, so the Vercel project needs **Root Directory = `careerprep-ai`**. That's a project setting: `vercel.json` has no field for it. `npm run setup` sets it through the Vercel API, so there's nothing to change in the dashboard. A root-level `vercel.json` is deliberately left out because it would also apply to any other Vercel project built from this repo.

## Known limitations

- Live transcription needs browser speech recognition (Chrome, Edge, Safari). Firefox falls back to Whisper when `OPENAI_API_KEY` is set, and to typed answers otherwise.
- Chrome's speech recognition often removes "um"/"uh", so filler counts can read low. Whisper is prompted to keep them.
- Scanned (image-only) PDFs are flagged as unreadable. There is no OCR.
- The rate limiter is in-memory, per server instance. Use Redis or Upstash at scale.
