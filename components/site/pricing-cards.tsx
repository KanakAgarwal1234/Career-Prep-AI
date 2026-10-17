"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/components/providers/app-provider";
import { startCheckout } from "@/components/paywall/upgrade-dialog";
import { PLANS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function PricingCards() {
  const { plan, requireAuth, authHeaders } = useApp();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "cancelled") toast.message("Checkout cancelled — you haven't been charged.");
  }, []);

  async function upgrade() {
    const user = await requireAuth("Create an account so your Pro plan follows you.");
    if (!user) return;
    setBusy(true);
    try {
      await startCheckout(user, await authHeaders());
    } catch (err) {
      toast.error("Couldn't start checkout", { description: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PLANS.map((p) => {
        const pro = p.id === "pro";
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-2xl border bg-white p-6 sm:p-8", pro && "border-zinc-900 shadow-[0_20px_50px_-20px_rgba(16,24,40,0.25)]")}>
            {pro && (
              <Badge variant="indigo" className="absolute right-6 top-6">
                <Sparkles /> Most popular
              </Badge>
            )}
            <h2 className="text-lg font-semibold tracking-tight">{p.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
              <span className="text-sm text-muted-foreground">/ {p.interval}</span>
            </div>
            <ul className="mt-6 grid gap-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className={cn("mt-0.5 size-4 shrink-0", pro ? "text-indigo-600" : "text-zinc-400")} /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-2 md:mt-auto">
              {pro ? (
                <Button size="lg" className="w-full" onClick={upgrade} disabled={busy || plan === "pro"}>
                  {busy && <Loader2 className="animate-spin" />}
                  {plan === "pro" ? "Your current plan" : "Upgrade to Pro"}
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="w-full" asChild>
                  <Link href="/review">Start free audit</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
