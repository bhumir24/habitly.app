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
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { WeeklySummary } from "@/types";

export function PerHabitBar({ data }: { data: WeeklySummary["per_habit"] }) {
  const rows = data.map((p) => ({
    name: p.title.length > 18 ? p.title.slice(0, 18) + "…" : p.title,
    completed: p.completed,
    skipped: p.skipped,
    rate: Math.round(p.rate * 100),
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
            formatter={(value: number, name: string) => [value, name === "completed" ? "Completed" : "Skipped"]}
          />
          <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="completed" />
          <Bar dataKey="skipped" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.4} name="skipped" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const MOOD_LABELS: Record<number, string> = { 1: "Low", 2: "Low-mid", 3: "Neutral", 4: "Good", 5: "Great" };

function MoodTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const mood = payload[0].value;
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        {mood} — {MOOD_LABELS[mood] ?? "—"}
      </div>
    </div>
  );
}

export function MoodLine({ data }: { data: WeeklySummary["mood_trend"] }) {
  const rows = data.map((d) => ({ day: format(parseISO(d.date), "EEE"), mood: d.mood }));
  return (
    <div className="space-y-2">
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
            <Tooltip content={<MoodTooltip />} />
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
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>1 = Low</span>
        <span>3 = Neutral</span>
        <span>5 = Great</span>
      </div>
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

  const rows = [...categoryMap.entries()].map(([cat, v]) => ({
    category: cat,
    completed: v.completed,
    skipped: v.skipped,
    rate: v.completed + v.skipped === 0 ? 0 : Math.round((v.completed / (v.completed + v.skipped)) * 100),
    color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other,
  })).sort((a, b) => b.rate - a.rate);

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
