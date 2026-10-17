"use client";

import * as React from "react";
import { toast } from "sonner";
import { getSupabase, supabaseEnabled } from "@/lib/supabase/client";
import { KEYS, readJSON, removeKey, writeJSON } from "@/lib/storage";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  demo: boolean;
}

interface AppContextValue {
  user: SessionUser | null;
  plan: "free" | "pro";
  ready: boolean;
  supabaseEnabled: boolean;
  /** Opens the sign-in dialog (if needed) and resolves with the user, or null if dismissed. */
  requireAuth: (reason?: string) => Promise<SessionUser | null>;
  openUpgrade: (reason?: string) => void;
  signInDemo: (email: string, name?: string) => SessionUser;
  signOut: () => Promise<void>;
  activatePro: () => void;
  /** Headers for entitlement-aware API calls. */
  authHeaders: () => Promise<Record<string, string>>;
}

const AppContext = React.createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [plan, setPlan] = React.useState<"free" | "pro">("free");
  const [ready, setReady] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authReason, setAuthReason] = React.useState<string | undefined>();
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [upgradeReason, setUpgradeReason] = React.useState<string | undefined>();
  const pending = React.useRef<((u: SessionUser | null) => void) | null>(null);
  const userRef = React.useRef<SessionUser | null>(null);
  userRef.current = user;

  const loadPlan = React.useCallback(async (u: SessionUser | null) => {
    const sb = getSupabase();
    if (sb && u && !u.demo) {
      const { data } = await sb.from("profiles").select("plan").eq("id", u.id).maybeSingle();
      setPlan(data?.plan === "pro" ? "pro" : "free");
    } else {
      setPlan(readJSON<string>(KEYS.plan) === "pro" ? "pro" : "free");
    }
  }, []);

  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      const demo = readJSON<SessionUser>(KEYS.demoUser);
      setUser(demo);
      loadPlan(demo).finally(() => setReady(true));
      return;
    }
    const toUser = (s: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null): SessionUser | null =>
      s ? { id: s.user.id, email: s.user.email || "", name: (s.user.user_metadata?.full_name as string) || undefined, demo: false } : null;

    sb.auth.getSession().then(({ data }) => {
      const u = toUser(data.session);
      setUser(u);
      loadPlan(u).finally(() => setReady(true));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = toUser(session);
      setUser(u);
      loadPlan(u);
      if (u && pending.current) {
        pending.current(u);
        pending.current = null;
        setAuthOpen(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadPlan]);

  const requireAuth = React.useCallback((reason?: string) => {
    if (userRef.current) return Promise.resolve(userRef.current);
    setAuthReason(reason);
    setAuthOpen(true);
    return new Promise<SessionUser | null>((resolve) => {
      pending.current = resolve;
    });
  }, []);

  const signInDemo = React.useCallback((email: string, name?: string) => {
    const u: SessionUser = { id: `demo_${btoa(email).replace(/=+$/, "").slice(0, 16)}`, email, name, demo: true };
    writeJSON(KEYS.demoUser, u);
    setUser(u);
    pending.current?.(u);
    pending.current = null;
    setAuthOpen(false);
    toast.success(`Signed in as ${email}`, { description: "Demo account — stored in this browser only." });
    return u;
  }, []);

  const signOut = React.useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    removeKey(KEYS.demoUser);
    setUser(null);
    setPlan(readJSON<string>(KEYS.plan) === "pro" && !sb ? "pro" : "free");
  }, []);

  const activatePro = React.useCallback(() => {
    writeJSON(KEYS.plan, "pro");
    setPlan("pro");
  }, []);

  const openUpgrade = React.useCallback((reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  }, []);

  const authHeaders = React.useCallback(async () => {
    const headers: Record<string, string> = {};
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    if (plan === "pro") headers["x-cp-plan"] = "pro";
    return headers;
  }, [plan]);

  const onAuthOpenChange = (open: boolean) => {
    setAuthOpen(open);
    if (!open && pending.current) {
      pending.current(userRef.current);
      pending.current = null;
    }
  };

  const value = React.useMemo<AppContextValue>(
    () => ({ user, plan, ready, supabaseEnabled, requireAuth, openUpgrade, signInDemo, signOut, activatePro, authHeaders }),
    [user, plan, ready, requireAuth, openUpgrade, signInDemo, signOut, activatePro, authHeaders],
  );

  return (
    <AppContext.Provider value={value}>
      <TooltipProvider>
        {children}
        <AuthDialog open={authOpen} onOpenChange={onAuthOpenChange} reason={authReason} />
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} reason={upgradeReason} />
        <Toaster />
      </TooltipProvider>
    </AppContext.Provider>
  );
}
