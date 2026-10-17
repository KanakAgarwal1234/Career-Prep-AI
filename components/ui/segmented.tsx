"use client";

import { cn } from "@/lib/utils";

/** Compact segmented control (radio group semantics) used for small enums. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-zinc-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-md px-2 text-[13px] font-medium text-zinc-600 transition outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            value === o.value ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
