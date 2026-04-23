import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { HabitDetail } from "@/components/habit/habit-detail";
import type { Habit, HabitLog } from "@/types";

export const dynamic = "force-dynamic";

export default async function HabitPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: habit } = await supabase
    .from("habits")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!habit) notFound();

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", params.id)
    .eq("user_id", user.id)
    .order("completion_date", { ascending: false })
    .limit(30);

  return <HabitDetail habit={habit as Habit} logs={(logs ?? []) as HabitLog[]} />;
}
