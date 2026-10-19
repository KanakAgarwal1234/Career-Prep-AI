"use client";

/* Minimal typings — the Web Speech recognition API isn't in every TS DOM lib. */
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  [i: number]: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const sttSupported = () => getCtor() !== null;

/**
 * Continuous speech-to-text session. Chrome ends recognition on its own after
 * silence or ~60s, so we transparently restart while the session is active.
 */
export class LiveTranscriber {
  private rec: SRInstance | null = null;
  private active = false;
  private finals: string[] = [];
  private confidences: number[] = [];
  private interim = "";
  private restarts = 0;

  constructor(
    private opts: {
      lang?: string;
      onUpdate: (finalText: string, interim: string) => void;
      onFatal?: (error: string) => void;
    },
  ) {}

  get text() {
    return [...this.finals, this.interim].join(" ").replace(/\s+/g, " ").trim();
  }

  get confidence() {
    const c = this.confidences.filter((x) => x > 0);
    return c.length ? c.reduce((a, b) => a + b, 0) / c.length : undefined;
  }

  start() {
    const Ctor = getCtor();
    if (!Ctor) throw new Error("Speech recognition not supported");
    this.active = true;
    this.finals = [];
    this.confidences = [];
    this.interim = "";
    this.restarts = 0;
    this.spawn(Ctor);
  }

  private spawn(Ctor: SRCtor) {
    const rec = new Ctor();
    rec.lang = this.opts.lang || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          this.finals.push(r[0].transcript.trim());
          this.confidences.push(r[0].confidence);
        } else interim += r[0].transcript;
      }
      this.interim = interim.trim();
      this.opts.onUpdate(this.finals.join(" "), this.interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        this.active = false;
        this.opts.onFatal?.(e.error);
      }
    };
    rec.onend = () => {
      if (this.interim) {
        this.finals.push(this.interim);
        this.interim = "";
      }
      if (this.active && this.restarts++ < 50) {
        try {
          this.spawn(Ctor);
        } catch {
          /* ignore */
        }
      }
    };
    this.rec = rec;
    rec.start();
  }

  /** Stops listening and resolves with the final transcript. */
  stop(): Promise<string> {
    this.active = false;
    const rec = this.rec;
    if (!rec) return Promise.resolve(this.text);
    return new Promise((resolve) => {
      const done = () => resolve(this.text);
      const t = window.setTimeout(done, 900);
      rec.onend = () => {
        window.clearTimeout(t);
        if (this.interim) {
          this.finals.push(this.interim);
          this.interim = "";
        }
        done();
      };
      try {
        rec.stop();
      } catch {
        window.clearTimeout(t);
        done();
      }
    });
  }

  abort() {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      /* ignore */
    }
  }
}
