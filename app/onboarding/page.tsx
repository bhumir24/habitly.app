import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");

  const supabase = createClient();
  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 -z-10 grad-soft" />
      <div className="container max-w-3xl py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{"Let's build your plan"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answer 6 quick steps. Your AI coach plans around this.
          </p>
        </div>
        <OnboardingWizard
          initial={
            onboarding
              ? {
                  goals: onboarding.goals,
                  availability_min: onboarding.availability_min,
                  routine: onboarding.routine,
                  energy_level: onboarding.energy_level,
                  life_mode: onboarding.life_mode,
                  preferred_times: onboarding.preferred_times,
                  blockers: onboarding.blockers,
                  notes: onboarding.notes ?? "",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
