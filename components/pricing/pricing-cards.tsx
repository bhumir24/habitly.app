"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setTier } from "@/actions/subscriptions";
import type { PlanTier } from "@/types";

export function PricingCards({ currentTier }: { currentTier: PlanTier }) {
  const [tier, setT] = useState<PlanTier>(currentTier);
  const [isPending, startTransition] = useTransition();

  const change = (t: PlanTier) =>
    startTransition(async () => {
      const res = await setTier(t);
      if (res.ok) setT(t);
    });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className={tier === "free" ? "border-primary/40 ring-1 ring-primary/20" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Free</CardTitle>
          <div className="mt-1 text-3xl font-semibold">$0</div>
          <p className="text-sm text-muted-foreground">Everything to get started.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Feature>Full onboarding & AI starter plan</Feature>
          <Feature>Daily tracking + streaks</Feature>
          <Feature>Weekly summary</Feature>
          <Feature>Up to 5 active habits</Feature>
          <Feature>10 coach messages / day</Feature>
          <Button
            variant={tier === "free" ? "secondary" : "outline"}
            disabled={tier === "free" || isPending}
            onClick={() => change("free")}
            className="w-full"
          >
            {tier === "free" ? "Current plan" : "Switch to Free"}
          </Button>
        </CardContent>
      </Card>

      <Card
        className={`relative overflow-hidden ${tier === "premium" ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
      >
        <div className="absolute right-4 top-4">
          <Badge>
            <Sparkles className="mr-1 h-3 w-3" />
            Premium
          </Badge>
        </div>
        <CardHeader>
          <CardTitle className="text-lg">Premium</CardTitle>
          <div className="mt-1 text-3xl font-semibold">
            $6<span className="text-sm font-normal text-muted-foreground"> / mo</span>
          </div>
          <p className="text-sm text-muted-foreground">The full adaptive coach.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Feature>Unlimited habits (vs. 5 on Free)</Feature>
          <Feature>Unlimited coach messages (vs. 10/day on Free)</Feature>
          <Feature>Advanced AI coaching with persistent memory</Feature>
          <Feature>Deep adaptive planning (recovery weeks, progressions)</Feature>
          <Feature>Detailed reports: best windows &amp; mood trends</Feature>
          <Feature>Coach proactively surfaces insights & nudges</Feature>
          <Feature>Priority support</Feature>
          <Button
            disabled={tier === "premium" || isPending}
            onClick={() => change("premium")}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {tier === "premium" ? "Current plan" : "Upgrade — dev toggle"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            MVP: billing is a local feature-flag. Hook up Stripe when ready.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Check className="mt-0.5 h-4 w-4 text-success" />
      <span>{children}</span>
    </div>
  );
}
