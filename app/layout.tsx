import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppProvider } from "@/components/providers/app-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CareerPrep AI — Visual ATS audit & AI mock interviews", template: "%s · CareerPrep AI" },
  description:
    "See exactly what an ATS and a recruiter see in your resume, fix it line by line, then rehearse with an adaptive AI voice interviewer that scores your answers and delivery.",
  applicationName: "CareerPrep AI",
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
