"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { WeeklySummary } from "@/types";

export function PerHabitBar({ data }: { data: WeeklySummary["per_habit"] }) {
  const rows = data.map((p) => ({
    name: p.title.length > 18 ? p.title.slice(0, 18) + "…" : p.title,
    completed: p.completed,
    skipped: p.skipped,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: "hsl(var(--accent))" }}
          />
          <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="skipped" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodLine({ data }: { data: WeeklySummary["mood_trend"] }) {
  const rows = data.map((d) => ({ day: format(parseISO(d.date), "EEE"), mood: d.mood }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BestWindowsBar({ data }: { data: WeeklySummary["best_windows"] }) {
  const rows = data.map((w) => ({
    window: w.window.replace("_", " "),
    rate: Math.round(w.completion_rate * 100),
  }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="window" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
