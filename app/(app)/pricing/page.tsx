import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { PricingCards } from "@/components/pricing/pricing-cards";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pricing"
        subtitle="Start free. Upgrade when the deeper coaching earns its keep."
      />
      <PricingCards currentTier={sub?.tier ?? "free"} />
    </div>
  );
}
