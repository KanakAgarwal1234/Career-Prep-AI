"use client";

import * as React from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SetupForm } from "./setup-form";
import { MicCheckDialog, type AudioConfig } from "./mic-check-dialog";
import { InterviewChamber } from "./interview-chamber";
import type { InterviewSetup } from "@/lib/types";

export function InterviewApp() {
  const [setup, setSetup] = React.useState<InterviewSetup | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [audio, setAudio] = React.useState<AudioConfig | null>(null);

  if (setup && audio) {
    return (
      <InterviewChamber
        setup={{ ...setup, inputMode: audio.inputMode }}
        audio={audio}
        onExit={() => {
          setAudio(null);
          setSetup(null);
        }}
      />
    );
  }

  return (
    <>
      <SiteHeader />
      <SetupForm
        onStart={(s) => {
          setSetup(s);
          setChecking(true);
        }}
      />
      <MicCheckDialog
        open={checking}
        onOpenChange={setChecking}
        inputMode={setup?.inputMode || "voice"}
        onReady={(cfg) => {
          setChecking(false);
          setAudio(cfg);
        }}
      />
    </>
  );
}
