import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> & { id: string } };
}

/**
 * POST /api/stripe/webhook — keeps profiles.plan in sync with Stripe.
 * Configure the endpoint in Stripe with: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ received: true, note: "Supabase not configured" });
  const obj = event.data.object;
  const now = new Date().toISOString();

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = (obj.client_reference_id as string) || (obj.metadata as Record<string, string> | undefined)?.userId;
      if (userId) {
        await admin
          .from("profiles")
          .update({ plan: "pro", stripe_customer_id: obj.customer as string, stripe_subscription_id: (obj.subscription as string) || null, updated_at: now })
          .eq("id", userId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status as string);
      await admin.from("profiles").update({ plan: active ? "pro" : "free", updated_at: now }).eq("stripe_subscription_id", obj.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
