import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  const [{ data: profile }, { data: sub }, { data: onboarding }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("tier").eq("user_id", user.id).single(),
    supabase.from("onboarding_responses").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!onboarding) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar fullName={profile?.full_name ?? null} tier={sub?.tier ?? "free"} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 -z-10 grad-soft"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-[0.35]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 grain opacity-40"
          aria-hidden
        />
        <main className="relative flex-1">
          <div className="container max-w-6xl py-8 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
