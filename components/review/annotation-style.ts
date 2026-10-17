import { LayoutTemplate, ScanSearch, TrendingUp, type LucideIcon } from "lucide-react";
import type { AnnotationType, Severity } from "@/lib/types";

export const SEVERITY_STYLE: Record<
  Severity,
  { label: string; dot: string; highlight: string; active: string; pin: string; stroke: string; badge: "danger" | "warning" | "success" }
> = {
  critical: {
    label: "Red flag",
    dot: "bg-rose-500",
    highlight: "bg-rose-500/[0.07] ring-1 ring-rose-500/35",
    active: "bg-rose-500/[0.13] ring-2 ring-rose-500",
    pin: "bg-rose-500 text-white",
    stroke: "#f43f5e",
    badge: "danger",
  },
  warning: {
    label: "Improve",
    dot: "bg-amber-500",
    highlight: "bg-amber-400/[0.10] ring-1 ring-amber-500/40",
    active: "bg-amber-400/[0.18] ring-2 ring-amber-500",
    pin: "bg-amber-500 text-white",
    stroke: "#f59e0b",
    badge: "warning",
  },
  positive: {
    label: "Green flag",
    dot: "bg-emerald-500",
    highlight: "bg-emerald-500/[0.07] ring-1 ring-emerald-500/35",
    active: "bg-emerald-500/[0.13] ring-2 ring-emerald-500",
    pin: "bg-emerald-500 text-white",
    stroke: "#10b981",
    badge: "success",
  },
};

export const TYPE_META: Record<AnnotationType, { label: string; icon: LucideIcon }> = {
  ats: { label: "ATS", icon: ScanSearch },
  impact: { label: "Impact", icon: TrendingUp },
  format: { label: "Format", icon: LayoutTemplate },
};
