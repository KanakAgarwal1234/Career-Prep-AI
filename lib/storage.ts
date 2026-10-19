"use client";

/** Safe wrappers — storage can throw in private mode or when quota is exceeded. */
export function readJSON<T>(key: string, store: "local" | "session" = "local"): T | null {
  try {
    const raw = (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown, store: "local" | "session" = "local") {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function removeKey(key: string, store: "local" | "session" = "local") {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  demoUser: "cp.demoUser",
  plan: "cp.plan",
  resumeProfile: "cp.resumeProfile",
  lastAnalysis: "cp.lastAnalysis",
  interviewReport: "cp.interviewReport",
  trialUsed: "cp.trialUsed",
  fixedItems: "cp.fixedItems",
} as const;
