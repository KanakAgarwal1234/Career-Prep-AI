import type { DeliveryMetrics, InterviewReport, InterviewTurn } from "@/lib/types";
import { clamp, round } from "@/lib/utils";
import { countFillers, countHedges, wordsOf } from "./analysis";

export interface VoiceTiming {
  /** ms timestamps relative to when listening started */
  listenStart: number;
  submittedAt: number;
  firstVoiceAt: number | null;
  lastVoiceAt: number | null;
  /** silent gaps (ms) between voiced segments */
  pauses: number[];
  sttConfidence?: number;
}

/** Per-answer delivery metrics from the transcript + voice-activity timing. */
export function computeDelivery(transcript: string, timing: VoiceTiming | null): DeliveryMetrics {
  const words = wordsOf(transcript).length;
  const fillers = countFillers(transcript);
  const fillerCount = Object.values(fillers).reduce((a, b) => a + b, 0);
  const hedgeCount = countHedges(transcript);

  if (!timing || timing.firstVoiceAt === null || timing.lastVoiceAt === null) {
    return {
      words,
      durationSec: timing ? round((timing.submittedAt - timing.listenStart) / 1000, 1) : 0,
      speakingSec: 0,
      wpm: 0,
      fillerCount,
      fillers,
      pauses: { short: 0, medium: 0, long: 0 },
      longestPauseSec: 0,
      latencySec: 0,
      hedgeCount,
      sttConfidence: timing?.sttConfidence,
    };
  }

  const speakingMs = Math.max(1000, timing.lastVoiceAt - timing.firstVoiceAt);
  const pauses = { short: 0, medium: 0, long: 0 };
  for (const p of timing.pauses) {
    if (p >= 4000) pauses.long++;
    else if (p >= 2000) pauses.medium++;
    else if (p >= 1000) pauses.short++;
  }
  return {
    words,
    durationSec: round((timing.submittedAt - timing.listenStart) / 1000, 1),
    speakingSec: round(speakingMs / 1000, 1),
    wpm: Math.round(words / (speakingMs / 60000)),
    fillerCount,
    fillers,
    pauses,
    longestPauseSec: round(Math.max(0, ...timing.pauses) / 1000, 1),
    latencySec: round((timing.firstVoiceAt - timing.listenStart) / 1000, 1),
    hedgeCount,
    sttConfidence: timing.sttConfidence,
  };
}

export function paceLabel(wpm: number) {
  if (!wpm) return "Not measured";
  if (wpm < 110) return "Slow";
  if (wpm < 130) return "Measured";
  if (wpm <= 165) return "Ideal";
  if (wpm <= 185) return "Brisk";
  return "Rushed";
}

/** Aggregates per-answer metrics into the report's Voice & Delivery section. */
export function aggregateDelivery(turns: InterviewTurn[], voice: boolean): InterviewReport["delivery"] & { score: number } {
  const spoken = turns.filter((t) => t.metrics.speakingSec > 0);
  const totalWords = spoken.reduce((s, t) => s + t.metrics.words, 0);
  const totalSpeakMin = spoken.reduce((s, t) => s + t.metrics.speakingSec, 0) / 60;
  const avgWpm = totalSpeakMin > 0 ? Math.round(totalWords / totalSpeakMin) : 0;
  const fillers: Record<string, number> = {};
  for (const t of turns) for (const [k, v] of Object.entries(t.metrics.fillers)) fillers[k] = (fillers[k] || 0) + v;
  const fillerTotal = Object.values(fillers).reduce((a, b) => a + b, 0);
  const minutes = totalSpeakMin || turns.reduce((s, t) => s + t.metrics.words, 0) / 140;
  const fillerPerMin = minutes > 0 ? round(fillerTotal / minutes, 1) : 0;
  const pauses = turns.reduce(
    (acc, t) => ({ short: acc.short + t.metrics.pauses.short, medium: acc.medium + t.metrics.pauses.medium, long: acc.long + t.metrics.pauses.long }),
    { short: 0, medium: 0, long: 0 },
  );
  const avgLatencySec = spoken.length ? round(spoken.reduce((s, t) => s + t.metrics.latencySec, 0) / spoken.length, 1) : 0;
  const hedges = turns.reduce((s, t) => s + t.metrics.hedgeCount, 0);

  // Pace score: 100 inside 130–165 wpm, falling off either side.
  const paceScore = !voice || !avgWpm ? 70 : avgWpm < 130 ? clamp(100 - (130 - avgWpm) * 1.6) : avgWpm > 165 ? clamp(100 - (avgWpm - 165) * 1.8) : 100;
  const fillerScore = clamp(100 - Math.max(0, fillerPerMin - 1.5) * 12);
  const pauseScore = clamp(100 - pauses.long * 9 - pauses.medium * 3);
  const latencyScore = !voice ? 80 : clamp(100 - Math.max(0, avgLatencySec - 3) * 10);
  const confidence = clamp(Math.round(92 - hedges * 4 - Math.max(0, fillerPerMin - 2) * 5 - pauses.long * 3 - Math.max(0, avgLatencySec - 4) * 3));
  const score = Math.round(voice ? paceScore * 0.3 + fillerScore * 0.25 + pauseScore * 0.2 + latencyScore * 0.1 + confidence * 0.15 : fillerScore * 0.4 + confidence * 0.6);

  const notes: string[] = [];
  if (voice && avgWpm) {
    if (avgWpm > 165) notes.push(`You averaged ${avgWpm} WPM — about ${Math.round(((avgWpm - 150) / avgWpm) * 100)}% faster than the 130–165 sweet spot. Slow down on numbers and key results.`);
    else if (avgWpm < 130) notes.push(`You averaged ${avgWpm} WPM — slightly slow. Tighten your opening sentence so the point lands sooner.`);
    else notes.push(`Pace of ${avgWpm} WPM is right in the 130–165 range interviewers find easiest to follow.`);
  }
  if (fillerTotal) {
    const top = Object.entries(fillers).sort((a, b) => b[1] - a[1])[0];
    notes.push(`${fillerTotal} filler word${fillerTotal > 1 ? "s" : ""} (${fillerPerMin}/min); most common: “${top[0]}”. Replace with a silent one-beat pause.`);
  } else notes.push("No filler words detected — clean, deliberate phrasing.");
  if (pauses.long) notes.push(`${pauses.long} long pause${pauses.long > 1 ? "s" : ""} over 4s. Use a bridge (“Let me think about the best example…”) to hold the floor.`);
  if (hedges >= 3) notes.push(`${hedges} hedging phrases (“I think”, “maybe”). State conclusions plainly — it reads as more confident.`);
  if (voice && avgLatencySec > 4) notes.push(`You took ~${avgLatencySec}s to start answering. A 2-second pause is fine; longer reads as uncertainty.`);

  return {
    avgWpm,
    paceLabel: voice ? paceLabel(avgWpm) : "Text mode",
    fillerPerMin,
    fillerTotal,
    fillers,
    pauses,
    avgLatencySec,
    confidence,
    confidenceLabel: confidence >= 80 ? "Assured" : confidence >= 62 ? "Steady" : "Tentative",
    notes,
    score,
  };
}
