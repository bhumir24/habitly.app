"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

export function CompletionConfetti({
  completed,
  total,
  dateKey,
}: {
  completed: number;
  total: number;
  dateKey: string;
}) {
  const lastTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (total <= 0 || completed !== total) return;

    const runKey = `confetti:${dateKey}:${total}`;
    if (lastTriggeredRef.current === runKey) return;

    try {
      const alreadyShown = window.sessionStorage.getItem(runKey) === "1";
      if (alreadyShown) return;

      const shoot = (originX: number) =>
        confetti({
          particleCount: 70,
          spread: 75,
          startVelocity: 45,
          origin: { x: originX, y: 0.75 },
        });

      shoot(0.2);
      shoot(0.8);
      window.sessionStorage.setItem(runKey, "1");
      lastTriggeredRef.current = runKey;
    } catch {
      // No-op: confetti should never block app usage.
    }
  }, [completed, total, dateKey]);

  return null;
}
