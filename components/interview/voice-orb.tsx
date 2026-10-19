"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "speaking" | "listening" | "thinking";

const BARS = 7;

/**
 * Interviewer presence indicator. Audio level is read from a ref every frame
 * and written straight to the DOM, so it animates at 60fps without re-renders.
 */
export function VoiceOrb({ state, levelRef, size = 200 }: { state: OrbState; levelRef: React.RefObject<number>; size?: number }) {
  const bars = React.useRef<(HTMLSpanElement | null)[]>([]);
  const ring1 = React.useRef<HTMLDivElement>(null);
  const ring2 = React.useRef<HTMLDivElement>(null);
  const smooth = React.useRef(0);

  React.useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const target = state === "thinking" ? 0.12 + Math.sin(t / 380) * 0.06 : state === "idle" ? 0 : levelRef.current || 0;
      smooth.current += (target - smooth.current) * (target > smooth.current ? 0.45 : 0.12);
      const lvl = smooth.current;
      bars.current.forEach((el, i) => {
        if (!el) return;
        const phase = Math.sin(t / (140 + i * 23) + i * 1.7) * 0.5 + 0.5;
        const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2) * 0.55;
        const h = 0.14 + lvl * center * (0.55 + phase * 0.45);
        el.style.transform = `scaleY(${Math.min(1, h)})`;
      });
      if (ring1.current) ring1.current.style.transform = `scale(${1 + lvl * 0.16})`;
      if (ring2.current) ring2.current.style.transform = `scale(${1 + lvl * 0.3})`;
      if (ring2.current) ring2.current.style.opacity = String(0.25 + lvl * 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, levelRef]);

  const tone =
    state === "speaking"
      ? { ring: "border-indigo-300", ring2: "bg-indigo-500/10", bar: "bg-indigo-600", core: "ring-indigo-100" }
      : state === "listening"
        ? { ring: "border-emerald-300", ring2: "bg-emerald-500/10", bar: "bg-emerald-600", core: "ring-emerald-100" }
        : { ring: "border-zinc-200", ring2: "bg-zinc-400/10", bar: "bg-zinc-400", core: "ring-zinc-100" };

  const core = size * 0.56;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <div ref={ring2} className={cn("absolute rounded-full transition-colors duration-500", tone.ring2)} style={{ width: size * 0.92, height: size * 0.92 }} />
      <div ref={ring1} className={cn("absolute rounded-full border transition-colors duration-500", tone.ring)} style={{ width: size * 0.74, height: size * 0.74 }} />
      <div
        className={cn("relative flex items-center justify-center gap-[5px] rounded-full bg-white shadow-[0_8px_30px_-6px_rgba(16,24,40,0.18)] ring-8 transition-colors duration-500", tone.core)}
        style={{ width: core, height: core }}
      >
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              bars.current[i] = el;
            }}
            className={cn("w-[5px] rounded-full transition-colors duration-500", tone.bar)}
            style={{ height: core * 0.46, transform: "scaleY(0.14)" }}
          />
        ))}
      </div>
    </div>
  );
}
