"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Mic, Volume2, Waves } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { MicMonitor, recorderSupported } from "@/lib/speech/mic";
import { loadVoices, pickVoice, speakBrowser, speakHd, ttsSupported } from "@/lib/speech/tts";
import { sttSupported } from "@/lib/speech/recognizer";
import { cn } from "@/lib/utils";

export interface AudioConfig {
  monitor: MicMonitor | null;
  voice: SpeechSynthesisVoice | null;
  hdVoice: boolean;
  stt: "live" | "whisper" | "none";
  inputMode: "voice" | "text";
}

interface Caps {
  tts: string | null;
  stt: string | null;
}

function Row({ state, icon: Icon, title, children }: { state: "idle" | "ok" | "warn" | "busy"; icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border p-3.5">
      <span className="mt-0.5">
        {state === "ok" ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : state === "warn" ? (
          <AlertTriangle className="size-5 text-amber-500" />
        ) : state === "busy" ? (
          <Loader2 className="size-5 animate-spin text-indigo-600" />
        ) : (
          <Circle className="size-5 text-zinc-300" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-3.5 text-zinc-500" /> {title}
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export function MicCheckDialog({
  open,
  onOpenChange,
  inputMode,
  onReady,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inputMode: "voice" | "text";
  onReady: (cfg: AudioConfig) => void;
}) {
  const [monitor, setMonitor] = React.useState<MicMonitor | null>(null);
  const [micState, setMicState] = React.useState<"idle" | "busy" | "ok" | "warn">("idle");
  const [micError, setMicError] = React.useState<string | null>(null);
  const [heard, setHeard] = React.useState(false);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = React.useState<string>("");
  const [hdVoice, setHdVoice] = React.useState(false);
  const [voiceTested, setVoiceTested] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [caps, setCaps] = React.useState<Caps>({ tts: null, stt: null });
  const meter = React.useRef<HTMLDivElement>(null);
  const handedOff = React.useRef(false);

  const live = sttSupported();
  const stt: AudioConfig["stt"] = live ? "live" : caps.stt && recorderSupported() ? "whisper" : "none";

  React.useEffect(() => {
    if (!open) return;
    handedOff.current = false;
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((c: Caps) => {
        setCaps(c);
        if (c.tts) setHdVoice(true);
      })
      .catch(() => {});
    loadVoices().then((v) => {
      const english = v.filter((x) => /^en/i.test(x.lang));
      setVoices(english);
      setVoiceURI(pickVoice(v)?.voiceURI || "");
    });
  }, [open]);

  // live level meter
  React.useEffect(() => {
    if (!monitor) return;
    let raf = 0;
    const tick = () => {
      const lvl = monitor.level();
      if (meter.current) meter.current.style.transform = `scaleX(${Math.max(0.02, Math.min(1, lvl * 1.6))})`;
      if (lvl > 0.12) setHeard(true);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [monitor]);

  // release the mic if the dialog closes without starting
  React.useEffect(() => {
    if (!open && monitor && !handedOff.current) {
      monitor.close();
      setMonitor(null);
      setMicState("idle");
      setHeard(false);
    }
  }, [open, monitor]);

  async function enableMic() {
    setMicState("busy");
    setMicError(null);
    try {
      const m = await MicMonitor.open();
      setMonitor(m);
      setMicState("ok");
    } catch (err) {
      const name = (err as DOMException)?.name;
      setMicError(name === "NotAllowedError" ? "Microphone access was blocked. Allow it from the address bar, or answer by typing." : name === "NotFoundError" ? "No microphone found." : "Couldn't open the microphone.");
      setMicState("warn");
    }
  }

  async function testVoice() {
    setSpeaking(true);
    const line = "Hi, I'll be your interviewer today. Can you hear me clearly?";
    try {
      if (hdVoice) await speakHd(line);
      else await speakBrowser(line, { voice: voices.find((v) => v.voiceURI === voiceURI) || null });
    } catch {
      setHdVoice(false);
      await speakBrowser(line, { voice: voices.find((v) => v.voiceURI === voiceURI) || null });
    }
    setSpeaking(false);
    setVoiceTested(true);
  }

  function start(mode: "voice" | "text") {
    handedOff.current = mode === "voice";
    if (mode === "text" && monitor) monitor.close();
    onReady({ monitor: mode === "voice" ? monitor : null, voice: voices.find((v) => v.voiceURI === voiceURI) || null, hdVoice, stt, inputMode: mode });
  }

  const voiceMode = inputMode === "voice";
  const canStart = !voiceMode || (micState === "ok" && stt !== "none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Audio check</DialogTitle>
          <DialogDescription>Thirty seconds now saves a derailed interview later.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5">
          {voiceMode && (
            <Row state={micState === "ok" ? (heard ? "ok" : "busy") : micState} icon={Mic} title="Microphone">
              {micState === "idle" && (
                <Button size="sm" variant="dark" onClick={enableMic}>
                  Allow microphone
                </Button>
              )}
              {micState === "busy" && "Waiting for permission…"}
              {micState === "warn" && <span className="text-amber-700">{micError}</span>}
              {micState === "ok" && monitor && (
                <div className="grid gap-2">
                  <div className="truncate text-xs">{monitor.label}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div ref={meter} className="h-full origin-left rounded-full bg-emerald-500 transition-transform duration-75" style={{ transform: "scaleX(0.02)" }} />
                  </div>
                  <div className={cn("text-xs", heard ? "text-emerald-700" : "")}>{heard ? "We can hear you." : "Say a few words to test your level…"}</div>
                </div>
              )}
            </Row>
          )}

          <Row state={voiceTested ? "ok" : speaking ? "busy" : "idle"} icon={Volume2} title="Interviewer voice">
            <div className="grid gap-2">
              {caps.tts && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={hdVoice} onChange={(e) => setHdVoice(e.target.checked)} className="accent-indigo-600" />
                  HD voice ({caps.tts === "elevenlabs" ? "ElevenLabs" : "OpenAI"})
                </label>
              )}
              {!hdVoice && ttsSupported() && voices.length > 1 && (
                <NativeSelect value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} className="h-9 text-[13px]" aria-label="Interviewer voice">
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {!ttsSupported() && !caps.tts && <span>Your browser can't speak questions aloud — they'll be shown on screen.</span>}
              <Button size="sm" variant="outline" onClick={testVoice} disabled={speaking || (!ttsSupported() && !caps.tts)} className="w-fit">
                <Volume2 /> {speaking ? "Playing…" : "Play test voice"}
              </Button>
            </div>
          </Row>

          {voiceMode && (
            <Row state={stt === "live" ? "ok" : stt === "whisper" ? "ok" : "warn"} icon={Waves} title="Transcription">
              {stt === "live" && "Live speech-to-text is available — you'll see your words as you speak."}
              {stt === "whisper" && "Your answers will be transcribed after you submit each one."}
              {stt === "none" && <span className="text-amber-700">This browser can't transcribe speech. Use Chrome or Edge, or answer by typing.</span>}
            </Row>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {voiceMode ? (
            <Button variant="ghost" onClick={() => start("text")}>
              Answer by typing instead
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => start(voiceMode ? "voice" : "text")} disabled={!canStart}>
            I&apos;m ready — start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
