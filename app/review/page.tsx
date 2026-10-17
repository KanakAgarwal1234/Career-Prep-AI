import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { ReviewApp } from "@/components/review/review-app";

export const metadata: Metadata = {
  title: "Visual ATS Audit",
  description: "Upload your resume PDF and see every ATS risk, weak bullet and strong result annotated directly on the page.",
};

export default function ReviewPage() {
  return (
    <>
      <SiteHeader />
      <ReviewApp />
    </>
  );
}
