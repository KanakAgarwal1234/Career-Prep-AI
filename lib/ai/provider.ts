import "server-only";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

export interface ResolvedModel {
  model: LanguageModel;
  provider: "openai" | "anthropic";
  modelId: string;
}

/**
 * Picks the LLM from env. `AI_PROVIDER` forces a provider; otherwise the first
 * configured key wins. Returns null when no key is set → callers use the
 * offline engines, so the app never hard-fails without credentials.
 */
export function getModel(): ResolvedModel | null {
  const pref = process.env.AI_PROVIDER?.toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (pref === "mock" || pref === "offline") return null;

  const useAnthropic = anthropicKey && (pref === "anthropic" || !openaiKey);
  if (useAnthropic) {
    const modelId = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
    return { model: createAnthropic({ apiKey: anthropicKey })(modelId), provider: "anthropic", modelId };
  }
  if (openaiKey) {
    const modelId = process.env.OPENAI_MODEL || "gpt-4o";
    const openai = createOpenAI({ apiKey: openaiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
    return { model: openai(modelId), provider: "openai", modelId };
  }
  return null;
}

export function llmTimeout(ms = 45_000) {
  return AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || ms);
}
