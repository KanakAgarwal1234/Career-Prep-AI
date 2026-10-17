import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe/server";

export const runtime = "nodejs";

const body = z.object({ userId: z.string().min(1).max(80), email: z.string().email(), returnPath: z.string().max(200).optional() });

/**
 * POST /api/checkout → { url }
 * Live: creates a Stripe Checkout Session for STRIPE_PRICE_ID.
 * Mock (no Stripe keys): returns the success URL directly so the full
 * paywall flow can be exercised locally.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sign in with a valid email first" }, { status: 400 });

  if (!stripeEnabled()) {
    return NextResponse.json({ url: `/checkout/success?session_id=mock_${Date.now().toString(36)}&mock=1`, mock: true });
  }
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const session = await createCheckoutSession({ origin, userId: parsed.data.userId, email: parsed.data.email });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Couldn't start checkout" }, { status: 502 });
  }
}
