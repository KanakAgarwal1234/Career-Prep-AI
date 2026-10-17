import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";

/** GET /api/capabilities — which optional integrations are configured (no secrets exposed). */
export function GET() {
  return NextResponse.json(getCapabilities(), { headers: { "cache-control": "no-store" } });
}
