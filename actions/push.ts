"use server";

import { createClient, getSessionUser } from "@/lib/supabase/server";
import { sendWebPush, EmailChannel } from "@/services/reminder-service";

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

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = createClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs?.length) {
    return {
      ok: false,
      error: "No push subscription found. Click Browser on a reminder, allow notifications, then Save.",
    };
  }

  await sendWebPush(subs, {
    title: "⏰ Test notification from Habitly",
    body: "Push notifications are working on this device!",
    url: "/dashboard",
  });
  return { ok: true };
}

export async function sendTestEmail(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const email = user.email;
  if (!email) return { ok: false, error: "No email on account" };

  const channel = new EmailChannel();
  await channel.sendDigest({
    to: email,
    time: "08:00",
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    habits: [
      { title: "Morning Run", duration: 30, fallback: "10-min walk" },
      { title: "Drink Water", duration: 0, fallback: null },
    ],
  });
  return { ok: true };
}
