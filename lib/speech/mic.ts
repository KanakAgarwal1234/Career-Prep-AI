"use client";

/**
 * Microphone level meter + voice-activity detector. Pause and pace analytics
 * come from here rather than from speech-to-text timing, which is unreliable.
 */
export class MicMonitor {
  readonly stream: MediaStream;
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private data: Uint8Array<ArrayBuffer>;

  private constructor(stream: MediaStream) {
    this.stream = stream;
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    src.connect(this.analyser);
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
  }

  static async open(deviceId?: string) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const m = new MicMonitor(stream);
    await m.ctx.resume();
    return m;
  }

  /** RMS level, roughly 0–1. */
  level() {
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.data.length) * 3.2);
  }

  get label() {
    return this.stream.getAudioTracks()[0]?.label || "Default microphone";
  }

  close() {
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close().catch(() => {});
  }
}

/** Adaptive-threshold voice activity tracker fed with periodic level samples. */
export class VoiceActivity {
  private floor = 0.02;
  private samples = 0;
  private voiced = false;
  private silenceStart: number | null = null;
  firstVoiceAt: number | null = null;
  lastVoiceAt: number | null = null;
  pauses: number[] = [];

  push(level: number, t: number) {
    this.samples++;
    // learn the noise floor from quiet samples
    if (level < this.floor * 2.5 || this.samples < 8) this.floor = this.floor * 0.95 + level * 0.05;
    const threshold = Math.max(0.045, this.floor * 2.6);
    const isVoice = level > threshold;
    if (isVoice) {
      if (this.firstVoiceAt === null) this.firstVoiceAt = t;
      if (!this.voiced && this.silenceStart !== null && this.lastVoiceAt !== null) {
        const gap = t - this.silenceStart;
        if (gap >= 1000) this.pauses.push(gap);
      }
      this.voiced = true;
      this.silenceStart = null;
      this.lastVoiceAt = t;
    } else if (this.voiced) {
      this.voiced = false;
      this.silenceStart = t;
    }
    return isVoice;
  }

  /** ms of silence since the last voiced sample (0 while speaking). */
  silenceFor(t: number) {
    return this.silenceStart === null ? 0 : t - this.silenceStart;
  }
}

/** Records the answer for server-side transcription when live STT isn't available. */
export class AnswerRecorder {
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  constructor(stream: MediaStream) {
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
    this.rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
  }
  start() {
    this.chunks = [];
    this.rec.start(1000);
  }
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      this.rec.onstop = () => resolve(new Blob(this.chunks, { type: this.rec.mimeType || "audio/webm" }));
      if (this.rec.state !== "inactive") this.rec.stop();
      else resolve(new Blob(this.chunks));
    });
  }
}

export const recorderSupported = () => typeof window !== "undefined" && "MediaRecorder" in window;
