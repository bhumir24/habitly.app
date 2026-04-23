import { useGetLatestInsight, useGenerateInsight, getGetLatestInsightQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart,
} from "recharts";
import { BarChart3, TrendingUp, RefreshCw, Loader2, Star, Target, Smile } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyData {
  date: string;
  completed: number;
  skipped: number;
  mood: number | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(220 14% 91%)",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export default function InsightsPage() {
  const { data: insight, isLoading } = useGetLatestInsight();
  const generateInsight = useGenerateInsight();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = () => {
    generateInsight.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLatestInsightQueryKey() });
        toast({ title: "Insight generated", description: "Your weekly report is ready." });
      },
    });
  };

  const chartData = insight?.chartData
    ? ((insight.chartData as { daily?: DailyData[] }).daily ?? []).map((d: DailyData) => ({
        date: formatDate(d.date),
        Completed: d.completed,
        Skipped: d.skipped,
        Mood: d.mood,
      }))
    : [];

  const completionPct = insight ? Math.round((insight.completionRate as number) * 100) : 0;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-[22px] font-display font-semibold">Weekly Insights</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">How your habits performed this week</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generateInsight.isPending}
            className="gap-2 rounded-xl text-[12px] font-semibold"
            data-testid="button-generate-insight"
          >
            {generateInsight.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        )}

        {!isLoading && !insight && (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 95%), hsl(262 60% 95%))" }}
            >
              <BarChart3 className="w-7 h-7" style={{ color: "hsl(245 70% 58%)" }} />
            </div>
            <h2 className="text-[17px] font-semibold mb-2">No insights yet</h2>
            <p className="text-[13px] text-muted-foreground mb-6 max-w-xs mx-auto">
              Complete some habits this week and generate your first report.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generateInsight.isPending}
              className="rounded-xl"
              data-testid="button-first-insight"
            >
              {generateInsight.isPending ? "Generating..." : "Generate my first insight"}
            </Button>
          </div>
        )}

        {insight && (
          <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-2xl p-4 text-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                  boxShadow: "0 4px 16px rgba(99,89,235,0.25)",
                }}
              >
                <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Target className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[22px] font-display font-semibold text-white leading-none">{completionPct}%</p>
                <p className="text-[11px] text-white/70 mt-1">Completion</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(152 55% 45%), hsl(165 50% 50%))",
                  boxShadow: "0 4px 16px rgba(40,160,100,0.2)",
                }}
              >
                <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[22px] font-display font-semibold text-white leading-none">{insight.totalCompleted}</p>
                <p className="text-[11px] text-white/70 mt-1">Habits done</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(38 85% 55%), hsl(25 90% 60%))",
                  boxShadow: "0 4px 16px rgba(210,140,40,0.2)",
                }}
              >
                <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Smile className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[22px] font-display font-semibold text-white leading-none">
                  {insight.averageMood ? (insight.averageMood as number).toFixed(1) : "—"}
                </p>
                <p className="text-[11px] text-white/70 mt-1">Avg mood</p>
              </div>
            </div>

            {/* Top habit */}
            {insight.topHabit && (
              <div
                className="flex items-center gap-3 px-5 py-4 rounded-2xl border"
                style={{
                  background: "linear-gradient(135deg, hsl(38 90% 98%), hsl(25 90% 98%))",
                  borderColor: "hsl(38 80% 88%)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(38 85% 55%), hsl(25 90% 60%))" }}
                >
                  <Star className="w-4 h-4 text-white fill-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Top habit this week</p>
                  <p className="text-[14px] font-semibold">{insight.topHabit as string}</p>
                </div>
              </div>
            )}

            {/* Bar chart */}
            {chartData.length > 0 && (
              <div
                className="bg-white rounded-2xl border p-5"
                style={{ borderColor: "hsl(220 14% 91%)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))" }}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="text-[14px] font-semibold">Daily completions</h2>
                  <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(245 70% 58%)" }} />
                      Done
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "hsl(220 14% 88%)" }} />
                      Skipped
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={chartData} barSize={14} barGap={3}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(220 14% 97%)", radius: 6 }} />
                    <Bar dataKey="Completed" fill="hsl(245, 70%, 58%)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="Skipped" fill="hsl(220, 14%, 86%)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Mood chart */}
            {chartData.some((d) => d.Mood !== null) && (
              <div
                className="bg-white rounded-2xl border p-5"
                style={{ borderColor: "hsl(220 14% 91%)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, hsl(38 85% 55%), hsl(25 90% 60%))" }}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="text-[14px] font-semibold">Mood trend</h2>
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={chartData.filter((d) => d.Mood !== null)}>
                    <defs>
                      <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38,85%,55%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(38,85%,55%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 93%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[1, 5]} hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="Mood"
                      stroke="hsl(38,85%,55%)"
                      strokeWidth={2.5}
                      fill="url(#moodGrad)"
                      dot={{ r: 3.5, fill: "hsl(38,85%,55%)", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* AI Summary */}
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{
                background: "linear-gradient(160deg, hsl(232 28% 14%) 0%, hsl(245 35% 20%) 100%)",
                borderColor: "hsl(245 35% 28%)",
              }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(245 70% 70%)" }}>
                  This week
                </p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "hsl(220 20% 78%)" }}>
                  {insight.aiSummary as string}
                </p>
              </div>
              <div className="border-t pt-4" style={{ borderColor: "hsl(245 35% 28%)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(152 60% 55%)" }}>
                  Next step
                </p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "hsl(220 20% 78%)" }}>
                  {insight.nextStep as string}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
