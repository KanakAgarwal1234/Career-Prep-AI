import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Thin Stripe REST client (form-encoded fetch) — avoids pinning an SDK
 * version for the three calls we need.
 */
export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

function encode(params: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v));
  return body;
}

async function stripe<T>(path: string, init: { method?: "GET" | "POST"; params?: Record<string, string | number | boolean | undefined> } = {}): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method || "GET",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: init.params ? encode(init.params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data as T;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
}

export function createCheckoutSession(opts: { origin: string; userId: string; email: string }) {
  const mode = process.env.STRIPE_MODE === "payment" ? "payment" : "subscription";
  return stripe<CheckoutSession>("checkout/sessions", {
    method: "POST",
    params: {
      mode,
      "line_items[0][price]": process.env.STRIPE_PRICE_ID,
      "line_items[0][quantity]": 1,
      success_url: `${opts.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${opts.origin}/pricing?checkout=cancelled`,
      client_reference_id: opts.userId,
      customer_email: opts.email,
      allow_promotion_codes: true,
      "metadata[userId]": opts.userId,
      ...(mode === "subscription" ? { "subscription_data[metadata][userId]": opts.userId } : {}),
    },
  });
}

export function retrieveCheckoutSession(id: string) {
  return stripe<CheckoutSession>(`checkout/sessions/${encodeURIComponent(id)}`);
}

/** Verifies a `Stripe-Signature` header (v1 scheme, 5-minute tolerance). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const signatures = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
