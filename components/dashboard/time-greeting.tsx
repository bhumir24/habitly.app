"use client";

import { useEffect, useState } from "react";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function TimeGreeting({
  firstName,
  fallback,
}: {
  firstName: string | null;
  fallback: string; // server-computed greeting shown before hydration
}) {
  const [greeting, setGreeting] = useState(fallback);

  useEffect(() => {
    // Override with browser's actual local time — more accurate than stored timezone
    const h = new Date().getHours();
    setGreeting(greetingForHour(h));
  }, []);

  return <>{greeting}{firstName ? `, ${firstName}` : ""}</>;
}
