import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import type { Habit, Profile, Reminder } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const [{ data: profile }, { data: habits }, { data: reminders }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("habits").select("*").eq("user_id", user.id),
    supabase.from("reminders").select("*").eq("user_id", user.id).order("remind_at"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Profile, reminders, and coaching preferences."
      />
      <SettingsForm
        profile={profile as Profile}
        habits={(habits ?? []) as Habit[]}
        reminders={(reminders ?? []) as Reminder[]}
      />
    </div>
  );
}
