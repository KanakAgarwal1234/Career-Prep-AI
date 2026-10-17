import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe/server";
import { getVerifiedUser, isDemoMode } from "@/lib/entitlements";

export const runtime = "nodejs";

const body = z.object({ userId: z.string().min(1).max(80), email: z.string().email(), returnPath: z.string().max(200).optional() });

/**
 * POST /api/checkout → { url }
 * - Supabase configured: the buyer is the user behind the verified bearer
 *   token (never the request body), so the webhook upgrades the right profile.
 *   No mock checkout — payments must be configured.
 * - Demo mode: no Stripe keys → returns the success URL directly so the full
 *   paywall flow can be exercised locally.
 */
export async function POST(req: Request) {
  let buyer: { id: string; email: string };

  if (isDemoMode()) {
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Sign in with a valid email first" }, { status: 400 });
    if (!stripeEnabled()) {
      return NextResponse.json({ url: `/checkout/success?session_id=mock_${Date.now().toString(36)}&mock=1`, mock: true });
    }
    buyer = { id: parsed.data.userId, email: parsed.data.email };
  } else {
    const user = await getVerifiedUser(req);
    if (!user) return NextResponse.json({ error: "Sign in to upgrade" }, { status: 401 });
    if (!stripeEnabled()) return NextResponse.json({ error: "Payments aren't configured yet" }, { status: 503 });
    buyer = user;
  }

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const session = await createCheckoutSession({ origin, userId: buyer.id, email: buyer.email });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Couldn't start checkout" }, { status: 502 });
  }
}
