import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingCards } from "@/components/site/pricing-cards";

export const metadata: Metadata = { title: "Pricing", description: "Free ATS audits forever. Pro unlocks full adaptive AI mock interviews and delivery analytics." };

const FAQ = [
  { q: "Is the ATS audit really free?", a: "Yes — unlimited audits, no card, no sign-up. You only create an account to save or download the full annotated report." },
  { q: "What's in the free interview trial?", a: "A 3-question voice interview (opener, a resume deep-dive and a role-specific question) with a core scorecard." },
  { q: "Is my audio recorded?", a: "In standard mode, speech is transcribed in your browser and audio never leaves your device. Only the text transcript is sent for scoring." },
  { q: "Can I cancel anytime?", a: "Yes. Manage or cancel your subscription from the Stripe customer portal — you keep Pro until the end of the billing period." },
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">The ATS audit is free forever. Upgrade when you&apos;re ready to rehearse the real thing.</p>
        </div>
        <PricingCards />
        <div className="mt-16 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-[15px] font-medium">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
