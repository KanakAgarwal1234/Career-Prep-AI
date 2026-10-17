"use client";

import * as React from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { ReportView } from "@/components/interview/report-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KEYS, readJSON } from "@/lib/storage";
import type { InterviewReport } from "@/lib/types";

export default function ReportPage() {
  const [report, setReport] = React.useState<InterviewReport | null | undefined>(undefined);

  React.useEffect(() => {
    setReport(readJSON<InterviewReport>(KEYS.interviewReport, "session") || readJSON<InterviewReport>(KEYS.interviewReport) || null);
  }, []);

  return (
    <>
      <SiteHeader />
      {report === undefined ? (
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : report ? (
        <ReportView report={report} />
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-28 text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-zinc-100">
            <Mic className="size-5 text-zinc-500" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">No evaluation yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">Finish a mock interview and your scorecard will appear here.</p>
          <Button className="mt-6" asChild>
            <Link href="/interview">Start a mock interview</Link>
          </Button>
        </div>
      )}
    </>
  );
}
