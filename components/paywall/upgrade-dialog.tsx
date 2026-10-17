"use client";

import * as React from "react";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/providers/app-provider";
import { PLANS, PRO_INTERVAL, PRO_PRICE } from "@/lib/pricing";

export async function startCheckout(user: { id: string; email: string }) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: user.id, email: user.email, returnPath: window.location.pathname }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Checkout unavailable");
  window.location.href = data.url;
}

export function UpgradeDialog({ open, onOpenChange, reason }: { open: boolean; onOpenChange: (o: boolean) => void; reason?: string }) {
  const { requireAuth, plan } = useApp();
  const [busy, setBusy] = React.useState(false);
  const pro = PLANS[1];

  async function upgrade() {
    onOpenChange(false);
    const user = await requireAuth("Create an account so your Pro plan follows you.");
    if (!user) return;
    setBusy(true);
    try {
      await startCheckout(user);
    } catch (err) {
      toast.error("Couldn't start checkout", { description: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
        <div className="border-b bg-zinc-50/80 p-6">
          <DialogHeader className="gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Sparkles className="size-4" />
            </span>
            <DialogTitle>Unlock the full interview</DialogTitle>
            <DialogDescription>{reason || "Your free trial covers 3 questions. Pro runs the complete adaptive interview."}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid gap-5 p-6">
          <ul className="grid gap-2.5">
            {pro.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-end justify-between rounded-lg border p-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerPrep Pro</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {PRO_PRICE}
                <span className="text-sm font-normal text-muted-foreground"> / {PRO_INTERVAL}</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">Cancel anytime</span>
          </div>
          <Button size="lg" onClick={upgrade} disabled={busy || plan === "pro"}>
            {busy ? <Loader2 className="animate-spin" /> : <Lock />}
            {plan === "pro" ? "You're on Pro" : "Continue to secure checkout"}
          </Button>
          <p className="-mt-2 text-center text-xs text-muted-foreground">Payments processed by Stripe.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
