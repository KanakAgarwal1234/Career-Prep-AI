"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { cn, scoreTone } from "@/lib/utils";

const TONE_STROKE = { good: "stroke-emerald-500", fair: "stroke-amber-500", poor: "stroke-rose-500" } as const;

export function ScoreRing({
  value,
  size = 132,
  stroke = 9,
  label,
  className,
  tone,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  className?: string;
  tone?: "good" | "fair" | "poor" | "indigo";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mv = useMotionValue(0);
  const dash = useTransform(mv, (v) => c - (v / 100) * c);
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value, mv]);

  const t = tone || scoreTone(value);
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-zinc-100" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dash }}
          className={cn("fill-none", t === "indigo" ? "stroke-indigo-600" : TONE_STROKE[t])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[2.1em] font-semibold leading-none tracking-tight" style={{ fontSize: size * 0.26 }}>
          {display}
        </span>
        {label && <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>}
      </div>
      <span className="sr-only">Score {value} out of 100</span>
    </div>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const t = scoreTone(value);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className={cn("h-full rounded-full", t === "good" ? "bg-emerald-500" : t === "fair" ? "bg-amber-500" : "bg-rose-500")}
      />
    </div>
  );
}
