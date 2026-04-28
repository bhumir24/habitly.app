"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  LineChart,
  Settings,
  Sparkles,
  LogOut,
  Target,
} from "lucide-react";
import { cn, firstNameFromFullName } from "@/lib/utils";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlanTier } from "@/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coach", label: "AI Coach", icon: MessageSquareText },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  fullName,
  tier,
}: {
  fullName: string | null;
  tier: PlanTier;
}) {
  const path = usePathname();
  const shortName = firstNameFromFullName(fullName);

  return (
    <aside className="sticky top-0 z-10 flex h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-card/85 px-3 py-5 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Habitly</div>
          <div className="text-[11px] text-muted-foreground">
            AI-Powered Habit Coach
          </div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <Link
          href="/pricing"
          className="block rounded-lg border bg-gradient-to-br from-primary/5 via-accent to-background p-3 text-sm hover:border-primary/30"
        >
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            {tier === "premium" ? "Premium active" : "Unlock Premium"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tier === "premium"
              ? "Advanced coach, deep reports, and smart reminders."
              : "Go deeper with adaptive coaching and reports."}
          </p>
        </Link>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {shortName ?? fullName ?? "Your account"}
            </div>
            <Badge
              variant={tier === "premium" ? "default" : "secondary"}
              className="mt-1"
            >
              {tier}
            </Badge>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
