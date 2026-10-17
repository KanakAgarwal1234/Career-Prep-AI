"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, History, Loader2, Mic, RotateCcw, SkipForward, Square, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/site/logo";
import { useApp } from "@/components/providers/app-provider";
import { VoiceOrb, type OrbState } from "./voice-orb";
import type { AudioConfig } from "./mic-check-dialog";
import { LiveTranscriber } from "@/lib/speech/recognizer";
import { AnswerRecorder, VoiceActivity } from "@/lib/speech/mic";
import { speakBrowser, speakHd, stopSpeaking, ttsSupported } from "@/lib/speech/tts";
import { computeDelivery } from "@/lib/interview/delivery";
import { introLine } from "@/lib/interview/planner";
import { KEYS, writeJSON } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase/client";
import type { InterviewQuestion, InterviewReport, InterviewSetup, InterviewTurn, NextQuestionResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "starting" | "asking" | "listening" | "processing" | "thinking" | "closing" | "evaluating";

const TYPE_LABEL: Record<InterviewQuestion["type"], string> = {
  opener: "Opener",
  behavioral: "Behavioral",
  technical: "Role-specific",
  situational: "Situational",
  resume: "Resume deep-dive",
  "follow-up": "Follow-up",
  closing: "Closing",
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function InterviewChamber({ setup, audio, onExit }: { setup: InterviewSetup; audio: AudioConfig; onExit: () => void }) {
  const router = useRouter();
  const { authHeaders, user } = useApp();
  const [phase, setPhase] = React.useState<Phase>("starting");
  const [turns, setTurns] = React.useState<InterviewTurn[]>([]);
  const [current, setCurrent] = React.useState<InterviewQuestion | null>(null);
  const [progress, setProgress] = React.useState({ index: 0, total: setup.plan === "pro" ? 7 : 3 });
  const [finalText, setFinalText] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [muted, setMuted] = React.useState(false);
  const [showLog, setShowLog] = React.useState(false);
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const [sessionSec, setSessionSec] = React.useState(0);
  const [answerSec, setAnswerSec] = React.useState(0);

  const levelRef = React.useRef(0);
  const turnsRef = React.useRef<InterviewTurn[]>([]);
  const currentRef = React.useRef<InterviewQuestion | null>(null);
  const transcriber = React.useRef<LiveTranscriber | null>(null);
  const recorder = React.useRef<AnswerRecorder | null>(null);
  const vad = React.useRef<VoiceActivity | null>(null);
  const listenStart = React.useRef(0);
  const loop = React.useRef(0);
  const speakAbort = React.useRef<AbortController | null>(null);
  const mutedRef = React.useRef(false);
  const started = React.useRef(false);
  const alive = React.useRef(true);
  const answerStartedAt = React.useRef(0);
  mutedRef.current = muted;

  const voice = audio.inputMode === "voice" && !!audio.monitor;

  /* ---------------- audio helpers ---------------- */

  const say = React.useCallback(
    async (text: string) => {
      if (!text || mutedRef.current || (!ttsSupported() && !audio.hdVoice)) {
        await new Promise((r) => setTimeout(r, mutedRef.current ? 600 : 300));
        return;
      }
      speakAbort.current?.abort();
      const ctrl = new AbortController();
      speakAbort.current = ctrl;
      const onLevel = (l: number) => {
        levelRef.current = l;
      };
      try {
        if (audio.hdVoice) await speakHd(text, { onLevel, signal: ctrl.signal });
        else await speakBrowser(text, { voice: audio.voice, onLevel, signal: ctrl.signal });
      } catch {
        await speakBrowser(text, { voice: audio.voice, onLevel, signal: ctrl.signal });
      }
      levelRef.current = 0;
    },
    [audio.hdVoice, audio.voice],
  );

  const stopLoop = () => {
    cancelAnimationFrame(loop.current);
    levelRef.current = 0;
  };

  const beginListening = React.useCallback(() => {
    if (!alive.current) return;
    setFinalText("");
    setInterim("");
    setTyped("");
    setPhase("listening");
    listenStart.current = performance.now();
    answerStartedAt.current = Date.now();
    setAnswerSec(0);
    if (!voice || !audio.monitor) return;

    vad.current = new VoiceActivity();
    const mon = audio.monitor;
    const tick = () => {
      const l = mon.level();
      levelRef.current = l;
      vad.current?.push(l, performance.now() - listenStart.current);
      loop.current = requestAnimationFrame(tick);
    };
    tick();

    if (audio.stt === "live") {
      const t = new LiveTranscriber({
        onUpdate: (f, i) => {
          setFinalText(f);
          setInterim(i);
        },
        onFatal: () => toast.error("Speech recognition stopped — check mic permissions, or type your answer."),
      });
      transcriber.current = t;
      try {
        t.start();
      } catch {
        toast.error("Couldn't start transcription");
      }
    } else if (audio.stt === "whisper") {
      recorder.current = new AnswerRecorder(mon.stream);
      recorder.current.start();
    }
  }, [voice, audio.monitor, audio.stt]);

  /* ---------------- interview flow ---------------- */

  const fetchNext = React.useCallback(
    async (history: InterviewTurn[]): Promise<NextQuestionResponse> => {
      const res = await fetch("/api/interview/next", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ setup, history }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't reach the interviewer");
      return res.json();
    },
    [setup, authHeaders],
  );

  const evaluate = React.useCallback(
    async (history: InterviewTurn[]) => {
      setPhase("evaluating");
      try {
        const res = await fetch("/api/interview/evaluate", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ setup, history }),
        });
        if (!res.ok) throw new Error("Evaluation failed");
        const report = (await res.json()) as InterviewReport;
        writeJSON(KEYS.interviewReport, report, "session");
        writeJSON(KEYS.interviewReport, report);
        if (setup.plan === "trial") writeJSON(KEYS.trialUsed, true);
        const sb = getSupabase();
        if (sb && user && !user.demo) {
          // best-effort history sync; the report is already stored locally
          sb.from("interviews")
            .insert({ user_id: user.id, role: setup.role, plan: report.setup.plan, overall_score: report.scores.overall, report })
            .then(({ error }) => error && console.warn("[interviews] save failed", error.message));
        }
        router.push("/interview/report");
      } catch (err) {
        toast.error((err as Error).message, { action: { label: "Retry", onClick: () => evaluate(history) } });
      }
    },
    [setup, authHeaders, router, user],
  );

  const askNext = React.useCallback(
    async (history: InterviewTurn[]) => {
      setPhase("thinking");
      let next: NextQuestionResponse;
      try {
        next = await fetchNext(history);
      } catch (err) {
        toast.error((err as Error).message, { action: { label: "Retry", onClick: () => askNext(history) } });
        return;
      }
      if (!alive.current) return;
      setProgress({ index: next.index, total: next.total });
      if (next.done || !next.question) {
        setPhase("closing");
        setCurrent(null);
        await say(next.closing || "That's the end of our interview. Thank you.");
        return evaluate(history);
      }
      currentRef.current = next.question;
      setCurrent(next.question);
      setPhase("asking");
      const preface = next.index === 0 ? introLine(setup, next.total) : next.ack || "";
      await say([preface, next.question.text].filter(Boolean).join(" "));
      if (alive.current && currentRef.current?.id === next.question.id) beginListening();
    },
    [fetchNext, say, evaluate, beginListening, setup],
  );

  // kick off once
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    askNext([]);
  }, [askNext]);

  // timers
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSessionSec((s) => s + 1);
      if (answerStartedAt.current) setAnswerSec(Math.floor((Date.now() - answerStartedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // teardown — the mic is released on a short delay so React's dev-mode
  // double-mount doesn't kill the stream we were handed.
  const closeTimer = React.useRef(0);
  React.useEffect(() => {
    alive.current = true;
    window.clearTimeout(closeTimer.current);
    return () => {
      alive.current = false;
      speakAbort.current?.abort();
      stopSpeaking();
      transcriber.current?.abort();
      cancelAnimationFrame(loop.current);
      closeTimer.current = window.setTimeout(() => {
        if (!alive.current) audio.monitor?.close();
      }, 250);
    };
  }, [audio.monitor]);

  async function collectAnswer(): Promise<{ text: string; metrics: InterviewTurn["metrics"] }> {
    stopLoop();
    const submittedAt = performance.now() - listenStart.current;
    let text = typed.trim();
    let confidence: number | undefined;
    if (voice) {
      if (audio.stt === "live" && transcriber.current) {
        text = await transcriber.current.stop();
        confidence = transcriber.current.confidence;
        transcriber.current = null;
      } else if (audio.stt === "whisper" && recorder.current) {
        const blob = await recorder.current.stop();
        recorder.current = null;
        const form = new FormData();
        form.append("audio", blob);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        text = res.ok ? ((await res.json()) as { text: string }).text : "";
      }
    }
    const v = vad.current;
    const timing = voice && v ? { listenStart: 0, submittedAt, firstVoiceAt: v.firstVoiceAt, lastVoiceAt: v.lastVoiceAt, pauses: v.pauses, sttConfidence: confidence } : null;
    return { text, metrics: computeDelivery(text, timing) };
  }

  async function submit(skip = false) {
    if (phase !== "listening" || !current) return;
    setPhase("processing");
    answerStartedAt.current = 0;
    const { text, metrics } = await collectAnswer();
    if (!skip && text.split(/\s+/).filter(Boolean).length < 3) {
      toast.message("We didn't catch an answer", { description: voice ? "Check your mic and try again, or skip the question." : "Type a few sentences, or skip the question." });
      if (!voice) setTyped(text);
      beginListening();
      return;
    }
    const turn: InterviewTurn = { question: current, answer: skip ? "" : text, metrics };
    const history = [...turnsRef.current, turn];
    turnsRef.current = history;
    setTurns(history);
    askNext(history);
  }

  async function reRecord() {
    if (phase !== "listening") return;
    stopLoop();
    transcriber.current?.abort();
    transcriber.current = null;
    if (recorder.current) await recorder.current.stop();
    recorder.current = null;
    beginListening();
  }

  async function repeat() {
    if (!current || (phase !== "listening" && phase !== "asking")) return;
    stopLoop();
    transcriber.current?.abort();
    transcriber.current = null;
    if (recorder.current) await recorder.current.stop();
    setPhase("asking");
    await say(current.text);
    beginListening();
  }

  function endNow() {
    setConfirmEnd(false);
    speakAbort.current?.abort();
    stopSpeaking();
    stopLoop();
    transcriber.current?.abort();
    if (turnsRef.current.length) evaluate(turnsRef.current);
    else onExit();
  }

  // Space / ⌘↵ submits
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.closest("textarea, input");
      if (phase !== "listening") return;
      if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (!inField && e.code === "Space")) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const orbState: OrbState = phase === "asking" || phase === "closing" ? "speaking" : phase === "listening" && voice ? "listening" : phase === "thinking" || phase === "processing" || phase === "evaluating" || phase === "starting" ? "thinking" : "idle";
  const status: Record<Phase, string> = {
    starting: "Preparing your interviewer…",
    asking: "Interviewer is speaking",
    listening: voice ? (audio.stt === "whisper" ? "Recording your answer" : "Listening") : "Your turn — type your answer",
    processing: audio.stt === "whisper" ? "Transcribing…" : "Saving your answer…",
    thinking: "Interviewer is thinking…",
    closing: "Wrapping up",
    evaluating: "Scoring your interview…",
  };
  const longAnswer = phase === "listening" && answerSec >= 120;

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,_#ffffff,_#f4f4f5_70%)]">
      {/* top bar */}
      <header className="flex h-14 items-center gap-3 border-b bg-white/70 px-4 backdrop-blur sm:px-6">
        <Logo className="size-6" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{setup.role}</div>
          <div className="text-[11px] text-muted-foreground">{setup.plan === "pro" ? "Full interview" : "Free trial"} · {setup.industry}</div>
        </div>
        <div className="mx-auto hidden items-center gap-1.5 sm:flex" aria-label={`Question ${Math.min(progress.index + 1, progress.total)} of ${progress.total}`}>
          {Array.from({ length: progress.total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i < turns.length ? "w-6 bg-zinc-900" : i === turns.length && current ? "w-10 bg-indigo-500" : "w-6 bg-zinc-200",
              )}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <span className="tabular mr-2 text-xs text-muted-foreground">{fmt(sessionSec)}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute interviewer" : "Mute interviewer"}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setShowLog((s) => !s)} aria-label="Conversation log">
            <History />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)} disabled={phase === "evaluating"}>
            <X /> End
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
          <VoiceOrb state={orbState} levelRef={levelRef} size={180} />
          <div className="mt-4 flex h-6 items-center gap-2 text-[13px] font-medium text-zinc-600" aria-live="polite">
            {(phase === "thinking" || phase === "processing" || phase === "evaluating" || phase === "starting") && <Loader2 className="size-3.5 animate-spin" />}
            {phase === "listening" && voice && <span className="size-2 animate-pulse rounded-full bg-emerald-500" />}
            {status[phase]}
          </div>

          <AnimatePresence mode="wait">
            {current && phase !== "evaluating" && phase !== "closing" && (
              <motion.section
                key={current.id + progress.index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="mt-8 w-full"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular font-medium text-zinc-900">
                    Question {progress.index + 1} of {progress.total}
                  </span>
                  <span>·</span>
                  <Badge variant={current.type === "follow-up" ? "indigo" : "outline"} className="font-normal">
                    {TYPE_LABEL[current.type]}
                  </Badge>
                  <span className="hidden sm:inline">{current.focus}</span>
                </div>
                <h2 className="text-balance text-xl font-medium leading-snug tracking-tight text-zinc-900 sm:text-2xl">{current.text}</h2>

                {/* answer surface */}
                <div className="mt-6 rounded-xl border bg-white p-4 shadow-xs sm:p-5">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span>{voice ? (audio.stt === "whisper" ? "Recording" : "Live transcript") : "Your answer"}</span>
                    {phase === "listening" && <span className={cn("tabular normal-case tracking-normal", longAnswer && "text-amber-600")}>{longAnswer ? `${fmt(answerSec)} · start wrapping up` : fmt(answerSec)}</span>}
                  </div>
                  {voice ? (
                    audio.stt === "whisper" ? (
                      <p className="min-h-24 text-[15px] leading-relaxed text-muted-foreground">
                        {phase === "listening" ? "Speak naturally — your words will be transcribed when you submit." : phase === "processing" ? "Transcribing your answer…" : "Waiting for the question to finish…"}
                      </p>
                    ) : (
                      <p className="scrollbar-thin max-h-56 min-h-24 overflow-y-auto text-[15px] leading-relaxed text-zinc-900">
                        {finalText}
                        {interim && <span className="text-zinc-400"> {interim}</span>}
                        {!finalText && !interim && <span className="text-zinc-400">{phase === "listening" ? "Start speaking whenever you're ready…" : phase === "asking" ? "Listen to the question…" : ""}</span>}
                      </p>
                    )
                  ) : (
                    <Textarea
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      disabled={phase !== "listening"}
                      placeholder={phase === "listening" ? "Type your answer as you'd say it…  (⌘/Ctrl + Enter to submit)" : "Wait for the question…"}
                      className="max-h-72 min-h-36 border-0 p-0 text-[15px] shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                  )}
                </div>

                {/* controls */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={repeat} disabled={phase !== "listening"}>
                      <RotateCcw /> Repeat question
                    </Button>
                    {voice && (
                      <Button variant="ghost" size="sm" onClick={reRecord} disabled={phase !== "listening"}>
                        <Mic /> Re-record
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => submit(true)} disabled={phase !== "listening"}>
                      <SkipForward /> Skip
                    </Button>
                  </div>
                  <Button size="lg" onClick={() => submit()} disabled={phase !== "listening"} className="min-w-52">
                    {phase === "processing" ? <Loader2 className="animate-spin" /> : voice ? <Square className="size-3.5 fill-current" /> : <CornerDownLeft />}
                    {voice ? "Done — submit answer" : "Submit answer"}
                    {voice && <kbd className="ml-1 rounded border border-white/30 px-1.5 text-[10px] font-normal opacity-80">Space</kbd>}
                  </Button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {(phase === "evaluating" || phase === "closing") && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 max-w-md text-center">
              <h2 className="text-xl font-semibold tracking-tight">{phase === "closing" ? "That's a wrap" : "Building your evaluation"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Scoring content, structure, resume alignment and delivery across {turns.length} answers.</p>
            </motion.div>
          )}
        </main>

        {/* conversation log */}
        <aside
          className={cn(
            "scrollbar-thin w-80 shrink-0 overflow-y-auto border-l bg-white/60 p-4",
            showLog ? "fixed inset-y-14 right-0 z-30 block shadow-xl lg:static lg:shadow-none" : "hidden lg:block",
          )}
        >
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Conversation</div>
          {turns.length === 0 && <p className="text-sm text-muted-foreground">Your answered questions will appear here.</p>}
          <ol className="grid gap-3">
            {turns.map((t, i) => (
              <li key={i} className="rounded-lg border bg-white p-3">
                <div className="text-[11px] text-muted-foreground">
                  Q{i + 1} · {TYPE_LABEL[t.question.type]}
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium">{t.question.text}</p>
                <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{t.answer || "Skipped"}</p>
                {t.metrics.wpm > 0 && (
                  <div className="tabular mt-2 flex gap-3 text-[11px] text-zinc-500">
                    <span>{t.metrics.wpm} wpm</span>
                    <span>{t.metrics.words} words</span>
                    <span>{t.metrics.fillerCount} fillers</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>End the interview?</DialogTitle>
            <DialogDescription>
              {turns.length ? `We'll score the ${turns.length} answer${turns.length > 1 ? "s" : ""} you've given so far.` : "You haven't answered any questions yet — nothing will be scored."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Keep going
            </Button>
            <Button variant="dark" onClick={endNow}>
              {turns.length ? "End & score" : "Exit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
