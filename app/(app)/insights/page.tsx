import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { mondayOf, toISODate } from "@/lib/date";
import type { WeeklyReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const thisWeek = toISODate(mondayOf());
  const [{ data: report }, { data: sub }] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", thisWeek)
      .maybeSingle(),
    supabase.from("subscriptions").select("tier").eq("user_id", user.id).single(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly insights"
        subtitle="What worked, what didn't, and one concrete step for next week."
      />
      <InsightsPanel
        initial={(report as WeeklyReport) ?? null}
        tier={sub?.tier ?? "free"}
      />
    </div>
  );
}
