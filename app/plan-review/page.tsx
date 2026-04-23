import { redirect } from "next/navigation";
import { getSessionUser, createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/ai/provider";
import { PlanReview } from "@/components/plan/plan-review";

export const dynamic = "force-dynamic";

export default async function PlanReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/plan-review");

  const supabase = createClient();
  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!onboarding) redirect("/onboarding");

  const ai = await getAIProvider();
  const plan = await ai.generatePlan({ onboarding });

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 -z-10 grad-soft" />
      <div className="container max-w-4xl py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Review your plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit, regenerate, or accept. You can adjust anything later.
          </p>
        </div>
        <PlanReview initial={plan} />
      </div>
    </div>
  );
}
