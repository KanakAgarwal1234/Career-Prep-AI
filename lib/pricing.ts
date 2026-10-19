export const PRO_PRICE = process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "$19";
export const PRO_INTERVAL = process.env.NEXT_PUBLIC_PRO_INTERVAL_LABEL || "month";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    interval: "forever",
    blurb: "Everything you need to get past the ATS.",
    features: [
      "Unlimited visual ATS audits",
      "Line-by-line rewrite suggestions",
      "Keyword match against any job post",
      "1 trial interview (3 questions)",
      "Core interview scorecard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: PRO_PRICE,
    interval: PRO_INTERVAL,
    blurb: "Rehearse until the real interview feels familiar.",
    features: [
      "Unlimited 7-question adaptive interviews",
      "Follow-up drill-downs based on your answers",
      "Voice & delivery analytics (pace, pauses, fillers)",
      "Resume-alignment checks on every answer",
      "STAR ideal-answer frameworks + PDF export",
    ],
  },
] as const;
