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
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { WeeklySummary } from "@/types";

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
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" />
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

const MOOD_EMOJI: Record<number, string> = { 1: "😫", 2: "😕", 3: "😐", 4: "😊", 5: "🤩" };
const MOOD_LABEL: Record<number, string> = { 1: "Rough", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };

export function MoodLine({ data }: { data: WeeklySummary["mood_trend"] }) {
  const rows = data.filter((d) => d.mood > 0).map((d) => ({ day: format(parseISO(d.date), "EEE"), mood: d.mood }));

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
        <p className="text-center text-sm text-muted-foreground">
          No mood logged this week yet.
        </p>
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            width={28}
            tick={(props) => (
              <text x={props.x} y={props.y} dy={4} textAnchor="end" fontSize={14}>
                {MOOD_EMOJI[props.payload.value] ?? props.payload.value}
              </text>
            )}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [
              `${MOOD_EMOJI[Math.round(v)] ?? ""} ${MOOD_LABEL[Math.round(v)] ?? v}`,
              "Mood",
            ]}
          />
          <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} />
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
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, "Completion"]}
          />
          <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  health: "#22c55e",
  mind: "#a855f7",
  productivity: "#3b82f6",
  learning: "#f59e0b",
  social: "#ec4899",
  sleep: "#6366f1",
  nutrition: "#14b8a6",
  movement: "#f97316",
  other: "#94a3b8",
};

export function CategoryBar({ data }: { data: WeeklySummary["per_habit"] }) {
  const categoryMap = new Map<string, { completed: number; skipped: number }>();
  for (const p of data) {
    const cat = p.category ?? "other";
    const entry = categoryMap.get(cat) ?? { completed: 0, skipped: 0 };
    entry.completed += p.completed;
    entry.skipped += p.skipped;
    categoryMap.set(cat, entry);
  }

  const rows = [...categoryMap.entries()]
    .map(([cat, v]) => ({
      category: cat,
      completed: v.completed,
      skipped: v.skipped,
      rate: v.completed + v.skipped === 0 ? 0 : Math.round((v.completed / (v.completed + v.skipped)) * 100),
      color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, _name: string, props: { payload?: { completed: number; skipped: number } }) => [
              `${v}% (${props.payload?.completed ?? 0}/${(props.payload?.completed ?? 0) + (props.payload?.skipped ?? 0)})`,
              "Completion",
            ]}
          />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.category} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
