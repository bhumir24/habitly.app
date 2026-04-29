import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import type { Habit, LifeMode, Profile, Reminder } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const [{ data: profile }, { data: habits }, { data: reminders }, { data: onboarding }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.from("reminders").select("*").eq("user_id", user.id).order("remind_at"),
      supabase.from("onboarding_responses").select("routine").eq("user_id", user.id).maybeSingle(),
    ]);

  const routine = onboarding?.routine as
    | { life_modes?: LifeMode[] }
    | undefined;
  const initialLifeModes: LifeMode[] =
    routine?.life_modes && routine.life_modes.length > 0
      ? routine.life_modes.slice(0, 6)
      : [];

  const safeProfile: Profile = profile ?? {
    id: user.id,
    full_name: null,
    avatar_url: null,
    timezone: "UTC",
    energy_baseline: "medium",
    life_mode: "flexible",
    onboarded_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Profile, reminders, and coaching preferences."
      />
      <SettingsForm
        profile={safeProfile}
        habits={(habits ?? []) as Habit[]}
        reminders={(reminders ?? []) as Reminder[]}
        initialLifeModes={
          initialLifeModes.length > 0 ? initialLifeModes : [safeProfile.life_mode]
        }
        onboardingRoutine={(onboarding?.routine as Record<string, unknown>) ?? {}}
        hasOnboarding={!!onboarding}
      />
    </div>
  );
}
