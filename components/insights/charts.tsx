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
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { WeeklySummary } from "@/types";

// One grouped bar chart — all habits on x-axis, completed vs skipped side by side
export function PerHabitBar({ data }: { data: WeeklySummary["per_habit"] }) {
  const rows = data.map((h) => ({
    name: h.title.length > 14 ? h.title.slice(0, 14) + "…" : h.title,
    Completed: h.completed,
    Skipped: h.skipped,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-35}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: "hsl(var(--accent))" }} />
          <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Completed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="Skipped" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} maxBarSize={20} opacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodLine({ data }: { data: WeeklySummary["mood_trend"] }) {
  const rows = data
    .filter((d) => d.mood > 0)
    .map((d) => ({ day: format(parseISO(d.date), "EEE"), mood: d.mood }));

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
        <p className="text-center text-sm text-muted-foreground">
          No mood logged this week yet.<br />
          Rate your mood on the dashboard, then hit <strong>Re-run</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={(props) => {
              const EMOJI: Record<number, string> = { 1: "😫", 2: "😕", 3: "😐", 4: "😊", 5: "🤩" };
              return (
                <text x={props.x} y={props.y} dy={4} textAnchor="end" fontSize={14}>
                  {EMOJI[props.payload.value] ?? props.payload.value}
                </text>
              );
            }}
            width={28}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => {
              const EMOJI: Record<number, string> = { 1: "😫 Rough", 2: "😕 Low", 3: "😐 Okay", 4: "😊 Good", 5: "🤩 Great" };
              return [EMOJI[Math.round(v)] ?? v, "Mood"];
            }}
          />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
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
