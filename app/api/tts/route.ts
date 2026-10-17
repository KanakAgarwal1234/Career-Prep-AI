import { NextResponse } from "next/server";
import { z } from "zod";
import { allowLlmCall } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const body = z.object({ text: z.string().min(1).max(1200) });

/**
 * POST /api/tts { text } → audio/mpeg
 * High-fidelity interviewer voice via ElevenLabs (preferred) or OpenAI TTS.
 * Returns 501 when neither is configured; the client then uses Web Speech.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  if (!allowLlmCall(req, 120)) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  const { text } = parsed.data;

  let upstream: Response | null = null;
  if (process.env.ELEVENLABS_API_KEY) {
    const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5" }),
    });
  } else if (process.env.OPENAI_API_KEY) {
    upstream = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "alloy",
        input: text,
        instructions: "Speak as a warm, composed, professional hiring manager. Natural pace.",
        response_format: "mp3",
      }),
    });
  } else {
    return NextResponse.json({ error: "No TTS provider configured" }, { status: 501 });
  }

  if (!upstream.ok || !upstream.body) {
    console.error("[tts] upstream error", upstream.status, await upstream.text().catch(() => ""));
    return NextResponse.json({ error: "TTS provider error" }, { status: 502 });
  }
  return new Response(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
