import "server-only";
import type { Plan } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const TRIAL_QUESTIONS = 3;
export const PRO_QUESTIONS = 7;

/** Demo mode = Supabase not configured at all. Only then may the client's own claims be honoured. */
export const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

let warned = false;
function warnMisconfigured() {
  if (warned) return;
  warned = true;
  console.error("[entitlements] NEXT_PUBLIC_SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing — every caller is treated as trial.");
}

/** Verifies the caller's Supabase access token with Supabase Auth. Never trusts client-supplied ids. */
export async function getVerifiedUser(req: Request): Promise<{ id: string; email: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || "" };
}

/**
 * Resolves the caller's interview plan.
 * - Supabase configured: verifies the bearer token, then reads `profiles.plan`
 *   with the service role. Headers, cookies and localStorage are ignored.
 *   If the service-role key is missing, it fails closed (trial).
 * - Demo mode (no Supabase): trusts the `x-cp-plan` header set after a mock
 *   checkout, so the paywall can be exercised offline.
 */
export async function resolvePlan(req: Request): Promise<Plan> {
  if (isDemoMode()) return req.headers.get("x-cp-plan") === "pro" ? "pro" : "trial";

  const admin = getSupabaseAdmin();
  if (!admin) {
    warnMisconfigured();
    return "trial";
  }
  const user = await getVerifiedUser(req);
  if (!user) return "trial";
  const { data: profile } = await admin.from("profiles").select("plan, plan_expires_at").eq("id", user.id).maybeSingle();
  if (profile?.plan !== "pro") return "trial";
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) return "trial";
  return "pro";
}
