"use client";

/**
 * Text-to-speech with two backends:
 *  - "browser": Web Speech API (zero latency, free, offline)
 *  - "hd":      /api/tts (OpenAI or ElevenLabs) played through an <audio> element
 *               whose real amplitude drives the interviewer waveform.
 */

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const PREFERRED = [/Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Guy|Ava|Andrew).*Online/i, /Natural/i, /Microsoft (Aria|Jenny|Zira)/i, /Daniel/i, /Karen/i, /Moira/i];

export function loadVoices(timeout = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, timeout);
  });
}

export function pickVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  for (const re of PREFERRED) {
    const v = english.find((x) => re.test(x.name));
    if (v) return v;
  }
  return english.find((v) => /en-US/i.test(v.lang)) || english[0] || voices[0] || null;
}

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  /** Called with a 0–1 "energy" pulse on word boundaries (browser) or real RMS (hd). */
  onLevel?: (level: number) => void;
  signal?: AbortSignal;
}

function splitSentences(text: string) {
  return (text.match(/[^.!?]+[.!?]+["”’]?|[^.!?]+$/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

/** Speaks text sentence by sentence (works around Chrome cutting off long utterances). */
export function speakBrowser(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  speechSynthesis.cancel();
  const parts = splitSentences(text);
  return new Promise((resolve) => {
    let i = 0;
    let finished = false;
    let timer: number | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      opts.onLevel?.(0);
      resolve();
    };
    opts.signal?.addEventListener("abort", () => {
      speechSynthesis.cancel();
      finish();
    });
    const next = () => {
      if (finished) return;
      if (i >= parts.length) return finish();
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (opts.voice) u.voice = opts.voice;
      u.rate = opts.rate ?? 1;
      u.pitch = 1;
      u.onboundary = () => opts.onLevel?.(0.55 + Math.random() * 0.45);
      const advance = () => {
        window.clearTimeout(timer);
        next();
      };
      u.onend = advance;
      u.onerror = advance;
      // Safety net: some browsers never fire onend.
      const words = u.text.split(/\s+/).length;
      timer = window.setTimeout(advance, (words / 2.3) * 1000 + 2500);
      speechSynthesis.speak(u);
    };
    next();
  });
}

let audioCtx: AudioContext | null = null;

/** Plays server-generated speech and reports true output amplitude. */
export async function speakHd(text: string, opts: SpeakOptions = {}): Promise<void> {
  const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: opts.signal });
  if (!res.ok) throw new Error("HD voice unavailable");
  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  audioCtx ||= new AudioContext();
  await audioCtx.resume();
  const src = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    opts.onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
    raf = requestAnimationFrame(tick);
  };
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      cancelAnimationFrame(raf);
      opts.onLevel?.(0);
      URL.revokeObjectURL(url);
      src.disconnect();
    };
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Playback failed"));
    };
    opts.signal?.addEventListener("abort", () => {
      audio.pause();
      cleanup();
      resolve();
    });
    audio.play().then(() => tick(), reject);
  });
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
