import { NextResponse } from "next/server";
import { allowLlmCall } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/transcribe (multipart: audio) → { text }
 * Whisper fallback for browsers without live Web Speech recognition (e.g. Firefox).
 */
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "No speech-to-text provider configured" }, { status: 501 });
  if (!allowLlmCall(req, 120)) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording too long" }, { status: 413 });

  const upstreamForm = new FormData();
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
  upstreamForm.append("file", audio, `answer.${ext}`);
  upstreamForm.append("model", process.env.OPENAI_STT_MODEL || "whisper-1");
  upstreamForm.append("language", "en");
  // Ask Whisper to keep disfluencies so filler-word analytics still work.
  upstreamForm.append("prompt", "Um, uh, like, you know — I mean, so, basically, the interview answer.");

  const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: upstreamForm,
  });
  if (!res.ok) {
    console.error("[transcribe] upstream error", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text || "" });
}
