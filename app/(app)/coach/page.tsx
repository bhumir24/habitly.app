import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { CoachChat } from "@/components/coach/coach-chat";
import type { CoachMessage } from "@/types";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const [{ data: profile }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Coach"
        subtitle="Short, practical, habit-oriented replies — grounded in your plan & logs."
      />
      <CoachChat
        initialMessages={(messages ?? []) as CoachMessage[]}
        fullName={profile?.full_name ?? null}
      />
    </div>
  );
}
