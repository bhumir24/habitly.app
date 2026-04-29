"use server";

import { createClient, getSessionUser } from "@/lib/supabase/server";

export async function savePushSubscription(sub: PushSubscriptionJSON) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: (sub.keys as Record<string, string>)?.p256dh ?? "",
      auth: (sub.keys as Record<string, string>)?.auth ?? "",
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deletePushSubscription(endpoint: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  return { ok: true as const };
}
