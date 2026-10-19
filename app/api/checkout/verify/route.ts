import { NextResponse } from "next/server";
import { retrieveCheckoutSession, stripeEnabled } from "@/lib/stripe/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/checkout/verify?session_id=… → { pro, mock? }
 * Confirms payment on the success page. The webhook is the source of truth;
 * this also upgrades the profile so the user doesn't wait on webhook latency.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!stripeEnabled()) return NextResponse.json({ pro: id.startsWith("mock_"), mock: true });
  if (!id.startsWith("cs_")) return NextResponse.json({ pro: false }, { status: 400 });

  try {
    const session = await retrieveCheckoutSession(id);
    const paid = session.status === "complete" && session.payment_status !== "unpaid";
    const admin = getSupabaseAdmin();
    if (paid && admin && session.client_reference_id) {
      await admin
        .from("profiles")
        .update({ plan: "pro", stripe_customer_id: session.customer, stripe_subscription_id: session.subscription, updated_at: new Date().toISOString() })
        .eq("id", session.client_reference_id);
    }
    return NextResponse.json({ pro: paid });
  } catch (err) {
    console.error("[checkout/verify]", err);
    return NextResponse.json({ pro: false }, { status: 502 });
  }
}
