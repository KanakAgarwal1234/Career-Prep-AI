"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { VoiceOrb } from "@/components/interview/voice-orb";

/** A live-looking slice of the ATS audit: real highlights, arrows and callouts. */
export function ResumeMiniature() {
  return (
    <div className="relative h-[244px] w-full overflow-hidden rounded-lg border bg-stage" aria-hidden>
      <div className="absolute left-5 top-5 w-[62%] rounded-[3px] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_8px_24px_-8px_rgba(16,24,40,0.15)] ring-1 ring-zinc-900/5">
        <div className="h-2.5 w-24 rounded-full bg-zinc-800" />
        <div className="mt-1.5 h-1.5 w-32 rounded-full bg-zinc-200" />
        <div className="mt-4 h-1.5 w-14 rounded-full bg-zinc-400" />
        <div className="relative mt-2.5 rounded-[3px] bg-rose-500/[0.08] px-1.5 py-1 text-[8.5px] leading-tight text-zinc-700 ring-1 ring-rose-500/40">
          <span className="absolute -left-3.5 top-1/2 flex size-3 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500 text-[6px] font-bold text-white">1</span>
          • Responsible for managing the product roadmap
        </div>
        <div className="mt-1.5 h-1.5 w-[88%] rounded-full bg-zinc-100" />
        <div className="mt-1.5 h-1.5 w-[76%] rounded-full bg-zinc-100" />
        <div className="relative mt-2 rounded-[3px] bg-emerald-500/[0.08] px-1.5 py-1 text-[8.5px] leading-tight text-zinc-700 ring-1 ring-emerald-500/40">
          <span className="absolute -left-3.5 top-1/2 flex size-3 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-[6px] font-bold text-white">2</span>
          • Grew activation 34% across 120K users
        </div>
        <div className="mt-2 h-1.5 w-[82%] rounded-full bg-zinc-100" />
        <div className="mt-1.5 h-1.5 w-[64%] rounded-full bg-zinc-100" />
        <div className="mt-3 h-1.5 w-12 rounded-full bg-zinc-400" />
        <div className="mt-2 h-1.5 w-[70%] rounded-full bg-zinc-100" />
      </div>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <motion.path initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 }} d="M 73 26 C 66 26, 66 33.5, 60.5 33.5" fill="none" stroke="#f43f5e" strokeWidth="0.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.25 }} />
        <motion.path initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.45 }} d="M 73 62 C 66 62, 66 55, 58 55" fill="none" stroke="#10b981" strokeWidth="0.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.25 }} />
      </svg>
      <motion.div initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="absolute right-4 top-[16%] w-[27%] min-w-28 rounded-lg border bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1 text-[9px] font-semibold"><span className="size-1.5 rounded-full bg-rose-500" /> Passive opener</div>
        <div className="mt-1 text-[8px] leading-snug text-muted-foreground">Try: “Led the roadmap, lifting retention by [X%]”</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.7 }} className="absolute right-4 top-[54%] w-[27%] min-w-28 rounded-lg border bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1 text-[9px] font-semibold"><span className="size-1.5 rounded-full bg-emerald-500" /> Quantified impact</div>
        <div className="mt-1 text-[8px] leading-snug text-muted-foreground">Verb + metric. Keep it.</div>
      </motion.div>
      <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2.5 shadow-xs">
        <span className="tabular flex size-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">68</span>
        <span className="text-[10px] font-medium text-zinc-600">ATS score</span>
      </div>
    </div>
  );
}

export function InterviewMiniature() {
  const level = React.useRef(0.55);
  React.useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      level.current = 0.35 + Math.abs(Math.sin(t / 420)) * 0.5;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="relative flex h-[244px] w-full items-center gap-4 overflow-hidden rounded-lg border bg-[radial-gradient(ellipse_at_top,_#ffffff,_#f4f4f5_75%)] px-5" aria-hidden>
      <div className="shrink-0">
        <VoiceOrb state="speaking" levelRef={level} size={112} />
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Question 3 of 7 · Follow-up</div>
        <div className="rounded-lg border bg-white p-2.5 text-[11px] leading-snug text-zinc-800 shadow-xs">
          You said “we” a lot there. What specifically did <em>you</em> do, and which decisions were yours?
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ["Readiness", "78%"],
            ["Pace", "148 wpm"],
            ["Fillers", "1.2/min"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border bg-white px-2 py-1.5">
              <div className="text-[8px] text-muted-foreground">{k}</div>
              <div className="tabular text-[11px] font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
