"use client";

import * as React from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, MessageSquareText, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { renderPage } from "@/lib/pdf/client";
import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE } from "./annotation-style";
import { AnnotationCard } from "./annotation-card";

const GUTTER = 204; // right-hand callout column
const BUBBLE_H = 34;
const BUBBLE_GAP = 6;
const SEVERITY_PRIORITY = { critical: 0, positive: 1, warning: 2 } as const;

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function PageCanvas({ page, width, onRendered }: { page: PDFPageProxy; width: number; onRendered?: () => void }) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!canvas.current || width < 50) return;
    let task: RenderTask | null = null;
    const id = window.setTimeout(() => {
      task = renderPage(page, canvas.current!, width);
      task.promise
        .then(() => {
          setReady(true);
          onRendered?.();
        })
        .catch((err: Error) => {
          if (err?.name !== "RenderingCancelledException") console.error(err);
        });
    }, 60);
    return () => {
      window.clearTimeout(id);
      task?.cancel();
    };
  }, [page, width, onRendered]);

  return (
    <>
      <canvas ref={canvas} className={cn("block transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} />
      {!ready && <div className="absolute inset-0 animate-pulse bg-zinc-50" />}
    </>
  );
}

/**
 * Picks which annotations get a margin callout: as many as fit the page height,
 * red flags first, then green flags, then improvements. The rest keep their pin.
 */
function pickCallouts(items: Annotation[], pageHeight: number) {
  const capacity = Math.max(1, Math.floor(pageHeight / 64));
  if (items.length <= capacity) return items;
  const chosen = new Set(
    [...items]
      .sort((a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity] || a.y - b.y)
      .slice(0, capacity)
      .map((a) => a.id),
  );
  return items.filter((a) => chosen.has(a.id));
}

/** Stack callout bubbles in the gutter so they never overlap, keeping each as close to its anchor as possible. */
function layoutBubbles(items: { id: string; anchorY: number }[], pageHeight: number) {
  const sorted = [...items].sort((a, b) => a.anchorY - b.anchorY);
  const tops = new Map<string, number>();
  let cursor = -Infinity;
  for (const it of sorted) {
    const top = Math.max(it.anchorY - BUBBLE_H / 2, cursor + BUBBLE_GAP, 4);
    tops.set(it.id, top);
    cursor = top + BUBBLE_H;
  }
  // If we overflowed the bottom, push the stack back up.
  const overflow = cursor - (pageHeight - 4);
  if (overflow > 0) {
    let limit = pageHeight - 4;
    for (const it of [...sorted].reverse()) {
      const t = Math.max(4, Math.min(tops.get(it.id)!, limit - BUBBLE_H));
      tops.set(it.id, t);
      limit = t - BUBBLE_GAP;
    }
  }
  return tops;
}

interface StageProps {
  doc: PDFDocumentProxy;
  annotations: Annotation[];
  activeId: string | null;
  hoverId: string | null;
  setActiveId: (id: string | null) => void;
  setHoverId: (id: string | null) => void;
  indexOf: (id: string) => number;
}

function PageView({
  page,
  pageNumber,
  width,
  showGutter,
  annotations,
  activeId,
  hoverId,
  setActiveId,
  setHoverId,
  indexOf,
  ordered,
}: Omit<StageProps, "doc"> & { page: PDFPageProxy; pageNumber: number; width: number; showGutter: boolean; ordered: Annotation[] }) {
  const base = page.getViewport({ scale: 1 });
  const height = (width / base.width) * base.height;
  const mine = annotations.filter((a) => a.page === pageNumber);

  const callouts = React.useMemo(() => pickCallouts(mine, height), [mine, height]);
  const bubbleTops = React.useMemo(
    () => layoutBubbles(callouts.map((a) => ({ id: a.id, anchorY: (a.y + a.height / 2) * height })), height),
    [callouts, height],
  );

  const active = mine.find((a) => a.id === activeId) || null;
  const activeIdx = active ? ordered.findIndex((a) => a.id === active.id) : -1;

  return (
    <div className="relative mx-auto" style={{ width: width + (showGutter ? GUTTER : 0) }}>
      {/* the page */}
      <div
        className="relative rounded-[3px] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08),0_8px_28px_-6px_rgba(16,24,40,0.12)] ring-1 ring-zinc-900/5"
        style={{ width, height }}
        onClick={(e) => !(e.target as HTMLElement).closest("button, [data-annotation-card]") && setActiveId(null)}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[3px]">
          <PageCanvas page={page} width={width} />
        </div>

        {/* highlights */}
        <div className="pointer-events-none absolute inset-0">
          {mine.map((a) => {
            const s = SEVERITY_STYLE[a.severity];
            const isActive = a.id === activeId;
            const isHover = a.id === hoverId;
            return (
              <button
                key={a.id}
                id={`ann-${a.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveId(isActive ? null : a.id);
                }}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(null)}
                aria-label={`${s.label}: ${a.title}`}
                className={cn(
                  "pointer-events-auto absolute scroll-mt-24 rounded-[3px] transition-[background-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  isActive ? s.active : isHover ? s.active.replace("ring-2", "ring-1") : s.highlight,
                )}
                style={{ left: a.x * width, top: a.y * height, width: a.width * width, height: Math.max(a.height * height, 12) }}
              >
                <span
                  className={cn(
                    "absolute top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm ring-2 ring-white",
                    s.pin,
                    a.x * width > 26 ? "-left-[25px]" : "-left-[9px]",
                  )}
                >
                  {indexOf(a.id) + 1}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {active && (
            <AnnotationCard
              key={active.id}
              annotation={active}
              number={indexOf(active.id) + 1}
              total={ordered.length}
              pageWidth={width}
              pageHeight={height}
              onClose={() => setActiveId(null)}
              onPrev={activeIdx > 0 ? () => setActiveId(ordered[activeIdx - 1].id) : undefined}
              onNext={activeIdx < ordered.length - 1 ? () => setActiveId(ordered[activeIdx + 1].id) : undefined}
            />
          )}
        </AnimatePresence>
      </div>

      {/* connector arrows + callout bubbles */}
      {showGutter && (
        <>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width + GUTTER} height={height} aria-hidden>
            <defs>
              {(["critical", "warning", "positive"] as const).map((sev) => (
                <marker key={sev} id={`arrow-${sev}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={SEVERITY_STYLE[sev].stroke} />
                </marker>
              ))}
            </defs>
            {callouts.map((a) => {
              const startX = width + 14;
              const startY = (bubbleTops.get(a.id) || 0) + BUBBLE_H / 2;
              const endX = Math.min((a.x + a.width) * width + 3, width - 6);
              const endY = (a.y + a.height / 2) * height;
              const dx = Math.max(28, (startX - endX) * 0.45);
              const emphasised = a.id === activeId || a.id === hoverId;
              return (
                <motion.path
                  key={a.id}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: emphasised ? 1 : activeId ? 0.25 : 0.7 }}
                  transition={{ duration: 0.6, delay: 0.15 + indexOf(a.id) * 0.03 }}
                  d={`M ${startX} ${startY} C ${startX - dx} ${startY}, ${endX + dx} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={SEVERITY_STYLE[a.severity].stroke}
                  strokeWidth={emphasised ? 1.75 : 1.25}
                  strokeDasharray={a.severity === "positive" ? "0" : undefined}
                  markerEnd={`url(#arrow-${a.severity})`}
                />
              );
            })}
          </svg>
          {callouts.map((a) => {
            const s = SEVERITY_STYLE[a.severity];
            const emphasised = a.id === activeId || a.id === hoverId;
            return (
              <motion.button
                key={a.id}
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: activeId && !emphasised ? 0.55 : 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + indexOf(a.id) * 0.03 }}
                onClick={() => setActiveId(a.id === activeId ? null : a.id)}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(null)}
                className={cn(
                  "absolute flex items-center gap-2 rounded-lg border bg-white pl-2 pr-2.5 text-left shadow-xs transition-[box-shadow,border-color] outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500",
                  emphasised && "border-zinc-300 shadow-md",
                )}
                style={{ left: width + 14, top: bubbleTops.get(a.id), height: BUBBLE_H, width: GUTTER - 22 }}
              >
                <span className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", s.pin)}>
                  {indexOf(a.id) + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium leading-tight text-zinc-900">{a.title}</span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">{s.label}</span>
                </span>
              </motion.button>
            );
          })}
        </>
      )}
    </div>
  );
}

export function DocumentStage({ doc, annotations, ...rest }: StageProps) {
  const { activeId, setActiveId } = rest;
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [pages, setPages] = React.useState<PDFPageProxy[]>([]);
  const [zoom, setZoom] = React.useState(1);
  const [callouts, setCallouts] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1))).then((p) => !cancelled && setPages(p));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const avail = Math.max(0, containerWidth - 32);
  const canGutter = avail >= 540 + GUTTER;
  const showGutter = callouts && canGutter;
  const fit = Math.min(showGutter ? avail - GUTTER : avail, 760);
  const width = Math.max(280, Math.round(fit * zoom));

  const { indexOf } = rest;
  const ordered = React.useMemo(() => [...annotations].sort((a, b) => a.page - b.page || a.y - b.y), [annotations]);

  // keyboard navigation through annotations
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "Escape") setActiveId(null);
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "j" && e.key !== "k") return;
      const i = activeId ? indexOf(activeId) : -1;
      const next = e.key === "ArrowRight" || e.key === "j" ? Math.min(ordered.length - 1, i + 1) : Math.max(0, i - 1);
      const target = ordered[next];
      if (target) {
        e.preventDefault();
        setActiveId(target.id);
        document.getElementById(`ann-${target.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, indexOf, activeId, setActiveId]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* stage toolbar */}
      <div className="sticky top-14 z-20 flex items-center justify-between gap-2 border-b bg-stage/85 lg:top-0 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScanLine className="size-3.5" />
          <span className="tabular">
            {doc.numPages} page{doc.numPages > 1 ? "s" : ""} · {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
          </span>
          <span className="hidden text-zinc-400 lg:inline">· ← → to step through</span>
        </div>
        <div className="flex items-center gap-1">
          {canGutter && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={callouts ? "secondary" : "ghost"} size="icon-sm" onClick={() => setCallouts((c) => !c)} aria-pressed={callouts} aria-label="Toggle callouts">
                  <MessageSquareText />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{callouts ? "Hide" : "Show"} margin callouts</TooltipContent>
            </Tooltip>
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <Minus />
          </Button>
          <button onClick={() => setZoom(1)} className="tabular w-12 rounded text-center text-xs font-medium text-zinc-600 hover:text-zinc-900" aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <Plus />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-x-auto px-4 py-6 sm:py-8">
        {containerWidth > 0 && (
          <div className="flex flex-col gap-8 pb-24">
            {pages.map((page, i) => (
              <PageView
                key={i}
                page={page}
                pageNumber={i + 1}
                width={width}
                showGutter={showGutter}
                annotations={annotations}
                ordered={ordered}
                {...rest}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
