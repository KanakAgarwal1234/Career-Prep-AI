import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseServerEnabled = Boolean(url && serviceKey);

let admin: SupabaseClient | null = null;

/** Service-role client for trusted server work (webhooks, entitlement checks). Never expose to the browser. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseServerEnabled) return null;
  if (!admin) admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
