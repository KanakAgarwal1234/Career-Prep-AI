"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/providers/app-provider";

export default function CheckoutSuccessPage() {
  const { activatePro } = useApp();
  const [state, setState] = React.useState<"verifying" | "ok" | "failed">("verifying");
  const [mock, setMock] = React.useState(false);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session_id") || "";
    fetch(`/api/checkout/verify?session_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { pro: boolean; mock?: boolean }) => {
        setMock(Boolean(d.mock));
        if (d.pro) {
          activatePro();
          setState("ok");
        } else setState("failed");
      })
      .catch(() => setState("failed"));
  }, [activatePro]);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="size-6 animate-spin text-indigo-600" />
            <p className="mt-4 text-sm text-muted-foreground">Confirming your payment…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            >
              <Check className="size-7" />
            </motion.span>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">You&apos;re on Pro</h1>
            <p className="mt-2 text-sm text-muted-foreground">Full 7-question adaptive interviews and complete delivery analytics are unlocked.</p>
            {mock && <p className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">Mock checkout — add Stripe keys to take real payments.</p>}
            <Button size="lg" className="mt-8" asChild>
              <Link href="/interview">
                Start a full interview <ArrowRight />
              </Link>
            </Button>
          </>
        )}
        {state === "failed" && (
          <>
            <AlertTriangle className="size-6 text-amber-500" />
            <h1 className="mt-4 text-xl font-semibold tracking-tight">We couldn&apos;t confirm that payment</h1>
            <p className="mt-2 text-sm text-muted-foreground">If you were charged, your plan will update within a minute. Otherwise, try again from pricing.</p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/pricing">Back to pricing</Link>
            </Button>
          </>
        )}
      </div>
    </>
  );
}
