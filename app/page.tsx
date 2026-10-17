import Link from "next/link";
import { ArrowRight, FileSearch, Lock, Mic, ScanLine, Sparkles, Upload, Wand2 } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InterviewMiniature, ResumeMiniature } from "@/components/landing/miniatures";
import { RoleStarter } from "@/components/landing/role-starter";

const STEPS = [
  { icon: Upload, title: "Upload your resume", body: "PDF up to 5 MB. Parsed in your browser — layout, fonts and reading order included." },
  { icon: ScanLine, title: "See what the ATS sees", body: "Every red flag, green flag and rewrite pinned to the exact line on your page." },
  { icon: Mic, title: "Rehearse out loud", body: "An AI interviewer probes your real claims, follows up on vague answers and scores your delivery." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* hero */}
        <section className="relative overflow-hidden border-b bg-white">
          <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24">
            <Badge variant="outline" className="mb-6 gap-1.5 bg-white px-3 py-1 font-normal text-zinc-600 shadow-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Free ATS audit · no sign-up
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl sm:leading-[1.05]">
              Get past the ATS.
              <br />
              <span className="text-zinc-400">Then own the interview.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-zinc-600 sm:text-lg">
              See exactly what applicant-tracking software and recruiters see in your resume — marked up on the page. Then rehearse with an AI interviewer that listens,
              follows up and scores you.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/review">
                  <FileSearch /> Audit my resume — free
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/interview">
                  <Mic /> Try a mock interview
                </Link>
              </Button>
            </div>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> Your resume is never used to train AI models.
            </p>
          </div>
        </section>

        {/* the two products */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="group flex flex-col rounded-2xl border bg-white p-6 transition hover:shadow-[0_20px_50px_-24px_rgba(16,24,40,0.25)] sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <Badge variant="success">Free</Badge>
                <span className="text-xs text-muted-foreground">Part 1</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Instant Visual ATS Audit</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Parser risks, weak bullets and missing keywords — annotated directly on your document with one-click improved wording.
              </p>
              <div className="my-6">
                <ResumeMiniature />
              </div>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild>
                  <Link href="/review">
                    <Upload /> Upload resume
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">PDF only · max 5 MB · ~10 seconds</span>
              </div>
            </article>

            <article className="group flex flex-col rounded-2xl border bg-white p-6 transition hover:shadow-[0_20px_50px_-24px_rgba(16,24,40,0.25)] sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <Badge variant="indigo">
                  <Sparkles /> Pro
                </Badge>
                <span className="text-xs text-muted-foreground">Part 2 · free 3-question trial</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Adaptive AI Mock Interview</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A voice interviewer that verifies your resume claims, drills into vague answers and grades content, structure and delivery.
              </p>
              <div className="my-6">
                <InterviewMiniature />
              </div>
              <div className="mt-auto">
                <RoleStarter />
              </div>
            </article>
          </div>
        </section>

        {/* how it works */}
        <section className="border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg border bg-zinc-50">
                      <s.icon className="size-4 text-zinc-700" />
                    </span>
                    <span className="tabular text-xs font-medium text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl bg-zinc-950 p-7 text-white sm:flex-row sm:items-center sm:p-9">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Wand2 className="size-4 text-indigo-300" /> Ten seconds to your first fix
                </h3>
                <p className="mt-1 text-sm text-zinc-400">No account needed. Upload a PDF and start editing with the page in front of you.</p>
              </div>
              <Button size="lg" className="bg-white text-zinc-950 hover:bg-zinc-100" asChild>
                <Link href="/review">
                  Audit my resume <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
