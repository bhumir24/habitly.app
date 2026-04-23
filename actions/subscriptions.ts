"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { PlanTier } from "@/types";

// MVP: no real billing — we just flip the tier.
// In production, wire this to a Stripe webhook and ignore client-side calls.
export async function setTier(tier: PlanTier) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      { user_id: user.id, tier, provider: "manual" },
      { onConflict: "user_id" }
    );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
