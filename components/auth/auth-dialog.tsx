"use client";

import * as React from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/components/providers/app-provider";
import { getSupabase } from "@/lib/supabase/client";
import { Logo } from "@/components/site/logo";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthDialog({ open, onOpenChange, reason }: { open: boolean; onOpenChange: (o: boolean) => void; reason?: string }) {
  const { supabaseEnabled, signInDemo } = useApp();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
    }
  }, [open]);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Enter a valid email address.");
    setError(null);
    if (!supabaseEnabled) {
      signInDemo(email.trim().toLowerCase(), name.trim() || undefined);
      return;
    }
    setBusy(true);
    const { error } = await getSupabase()!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function google() {
    setBusy(true);
    const { error } = await getSupabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] gap-5">
        <DialogHeader className="items-start gap-3">
          <Logo className="size-8" />
          <div className="space-y-1">
            <DialogTitle>{sent ? "Check your inbox" : "Sign in to CareerPrep"}</DialogTitle>
            <DialogDescription>
              {sent ? `We sent a sign-in link to ${email}. Open it on this device to continue.` : reason || "Save reports, track progress and unlock interviews."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {sent ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            <MailCheck className="size-4 text-emerald-600" /> The link expires in 1 hour.
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            {supabaseEnabled && (
              <>
                <Button type="button" variant="outline" className="h-10" onClick={google} disabled={busy}>
                  <GoogleMark /> Continue with Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1" /> or <Separator className="flex-1" />
                </div>
              </>
            )}
            {!supabaseEnabled && (
              <div className="grid gap-2">
                <Label htmlFor="auth-name">Name</Label>
                <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="auth-email">Work or personal email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                aria-invalid={!!error}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Mail />}
              {supabaseEnabled ? "Email me a sign-in link" : "Continue"}
            </Button>
            {!supabaseEnabled && (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Demo mode — auth isn&apos;t connected yet, so this account lives only in your browser.
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
