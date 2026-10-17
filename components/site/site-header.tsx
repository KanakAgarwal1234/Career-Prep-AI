"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wordmark } from "@/components/site/logo";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/review", label: "ATS Scanner" },
  { href: "/interview", label: "Mock Interview" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, plan, ready, requireAuth, signOut, openUpgrade } = useApp();
  const [open, setOpen] = React.useState(false);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70", className)}>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="CareerPrep AI home">
          <Wordmark className="text-[15px]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
                  active && "bg-zinc-100 font-medium text-zinc-900",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {ready && plan === "pro" && <Badge variant="indigo" className="hidden sm:inline-flex"><Sparkles /> Pro</Badge>}
          {ready && plan !== "pro" && (
            <Button variant="ghost" size="sm" className="hidden text-indigo-700 hover:text-indigo-800 sm:inline-flex" onClick={() => openUpgrade()}>
              Upgrade
            </Button>
          )}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
                aria-expanded={menu}
              >
                {initials}
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-10 w-60 rounded-lg border bg-card p-1.5 shadow-lg"
                  >
                    <div className="px-2.5 py-2">
                      <div className="truncate text-sm font-medium">{user.name || user.email.split("@")[0]}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      <div className="mt-2 flex gap-1.5">
                        <Badge variant={plan === "pro" ? "indigo" : "secondary"}>{plan === "pro" ? "Pro" : "Free"}</Badge>
                        {user.demo && <Badge variant="outline">Demo</Badge>}
                      </div>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 hover:bg-muted"
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => requireAuth()} disabled={!ready}>
              Sign In
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t bg-white md:hidden"
            aria-label="Mobile"
          >
            <div className="grid gap-1 p-3">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                  {n.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
