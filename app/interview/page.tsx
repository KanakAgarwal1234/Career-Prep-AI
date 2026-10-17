import type { Metadata } from "next";
import { InterviewApp } from "@/components/interview/interview-app";

export const metadata: Metadata = {
  title: "AI Mock Interview",
  description: "An adaptive AI voice interviewer that asks behavioral, technical and resume-based questions — then scores your answers and delivery.",
};

export default function InterviewPage() {
  return <InterviewApp />;
}
