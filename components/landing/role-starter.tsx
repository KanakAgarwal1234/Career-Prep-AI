"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RoleStarter() {
  const router = useRouter();
  const [role, setRole] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(role.trim() ? `/interview?role=${encodeURIComponent(role.trim())}` : "/interview");
      }}
      className="flex gap-2"
    >
      <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role, e.g. Data Analyst" aria-label="Target role" className="h-10" />
      <Button type="submit" variant="dark" className="h-10 shrink-0">
        Start <ArrowRight />
      </Button>
    </form>
  );
}
