import "server-only";
import { getModel } from "@/lib/ai/provider";
import { supabaseServerEnabled } from "@/lib/supabase/server";

export interface Capabilities {
  llm: { provider: string; model: string } | null;
  tts: "elevenlabs" | "openai" | null;
  stt: "whisper" | null;
  stripe: boolean;
  supabase: boolean;
}

export function getCapabilities(): Capabilities {
  const m = getModel();
  const openai = Boolean(process.env.OPENAI_API_KEY);
  return {
    llm: m ? { provider: m.provider, model: m.modelId } : null,
    tts: process.env.ELEVENLABS_API_KEY ? "elevenlabs" : openai ? "openai" : null,
    stt: openai ? "whisper" : null,
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    supabase: supabaseServerEnabled,
  };
}
