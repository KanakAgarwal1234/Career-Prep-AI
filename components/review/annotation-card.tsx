"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE, TYPE_META } from "./annotation-style";

/** Renders "[X%]"-style placeholders as highlighted chips so candidates see what to fill in. */
export function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="rounded bg-amber-100 px-1 font-medium text-amber-900">
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Improved wording copied", { description: "Fill in any [bracketed] numbers before pasting." });
    return true;
  } catch {
    toast.error("Couldn't access the clipboard");
    return false;
  }
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export function AnnotationCard({
  annotation: a,
  number,
  total,
  pageWidth,
  pageHeight,
  onClose,
  onPrev,
  onNext,
}: {
  annotation: Annotation;
  number: number;
  total: number;
  pageWidth: number;
  pageHeight: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const mobile = useIsMobile();
  const [copied, setCopied] = React.useState(false);
  const s = SEVERITY_STYLE[a.severity];
  const T = TYPE_META[a.type];
  const positive = a.severity === "positive";

  const cardW = Math.min(384, pageWidth - 24);
  const anchorLeft = a.x * pageWidth;
  const left = Math.min(Math.max(anchorLeft, 12), pageWidth - cardW - 12);
  const below = (a.y + a.height) * pageHeight;
  const placeAbove = below + 330 > pageHeight && a.y * pageHeight > 330;
  const caretX = Math.min(Math.max(anchorLeft + Math.min(a.width * pageWidth, 120) / 2 - left, 18), cardW - 18);

  const positionStyle: React.CSSProperties = mobile
    ? {}
    : placeAbove
      ? { left, bottom: pageHeight - a.y * pageHeight + 12, width: cardW }
      : { left, top: below + 12, width: cardW };

  async function copy() {
    if (await copyText(a.suggestedText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <motion.div
      data-annotation-card
      role="dialog"
      aria-label={a.title}
      initial={{ opacity: 0, y: placeAbove ? 6 : -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: placeAbove ? 4 : -4, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "z-30 rounded-xl border bg-white shadow-[0_12px_40px_-8px_rgba(16,24,40,0.22)]",
        mobile ? "fixed inset-x-3 bottom-3 max-h-[70dvh] overflow-y-auto" : "absolute",
      )}
      style={positionStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {!mobile && (
        <span
          className={cn("absolute size-3 rotate-45 border bg-white", placeAbove ? "-bottom-1.5 border-l-0 border-t-0" : "-top-1.5 border-b-0 border-r-0")}
          style={{ left: caretX - 6 }}
          aria-hidden
        />
      )}
      <div className="relative p-4">
        <div className="flex items-center gap-1.5">
          <Badge variant={s.badge}>
            <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
          </Badge>
          <Badge variant="outline" className="text-zinc-600">
            <T.icon /> {T.label}
          </Badge>
          <span className="tabular ml-auto text-xs text-muted-foreground">
            {number} / {total}
          </span>
          <button onClick={onClose} className="-mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-3.5" />
          </button>
        </div>

        <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{a.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{a.note}</p>

        {!positive && (
          <div className="mt-3.5 space-y-2">
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Original</div>
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-500 line-through decoration-zinc-300">
                {a.originalText}
              </p>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-indigo-600">Suggested</div>
              <p className="whitespace-pre-line rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[13px] leading-relaxed text-zinc-900">
                <WithPlaceholders text={a.suggestedText} />
              </p>
            </div>
          </div>
        )}
        {positive && (
          <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[13px] leading-relaxed text-zinc-800">{a.originalText}</p>
        )}

        <div className="mt-4 flex items-center gap-2">
          {!positive && (
            <Button size="sm" onClick={copy} className="flex-1">
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy Improved Wording"}
            </Button>
          )}
          <div className={cn("flex gap-1", positive && "ml-auto")}>
            <Button variant="outline" size="icon-sm" onClick={onPrev} disabled={!onPrev} aria-label="Previous annotation">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={onNext} disabled={!onNext} aria-label="Next annotation">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
