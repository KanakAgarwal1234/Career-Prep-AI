import Link from "next/link";
import { Wordmark } from "@/components/site/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Wordmark className="text-sm" />
          <p className="text-xs text-muted-foreground">Your resume is processed for analysis only and never used to train models.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
          <Link href="/review" className="hover:text-foreground">ATS Scanner</Link>
          <Link href="/interview" className="hover:text-foreground">Mock Interview</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
        </nav>
      </div>
    </footer>
  );
}
