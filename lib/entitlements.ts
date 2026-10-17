import "server-only";
import type { Plan } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const TRIAL_QUESTIONS = 3;
export const PRO_QUESTIONS = 7;

/**
 * Resolves the caller's interview plan.
 * - With Supabase configured: verifies the bearer token and reads profiles.plan.
 * - Without it (local demo mode): trusts the `x-cp-plan` header set by the
 *   client after a mock checkout. Fine for demos; configure Supabase for production.
 */
export async function resolvePlan(req: Request): Promise<Plan> {
  const admin = getSupabaseAdmin();
  if (!admin) return req.headers.get("x-cp-plan") === "pro" ? "pro" : "trial";

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return "trial";
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user) return "trial";
  const { data: profile } = await admin.from("profiles").select("plan, plan_expires_at").eq("id", userData.user.id).maybeSingle();
  if (profile?.plan !== "pro") return "trial";
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) return "trial";
  return "pro";
}
