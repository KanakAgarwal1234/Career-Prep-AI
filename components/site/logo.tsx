import { cn } from "@/lib/utils";

/** Mark: a document corner + upward tick — "review, then rise". */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-zinc-900" />
      <path d="M10 8.5h8.5L23 13v10.5a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" fill="none" stroke="white" strokeOpacity=".9" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12.5 18.5l2.6 2.6 5.2-5.6" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Logo />
      <span>
        CareerPrep<span className="text-indigo-600"> AI</span>
      </span>
    </span>
  );
}
