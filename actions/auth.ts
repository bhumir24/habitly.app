"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signUpSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean } | null;

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    full_name: form.get("full_name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name } },
  });
  if (error) return { error: error.message };
  redirect("/onboarding");
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Invalid credentials" };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  const next = (form.get("next") as string) || "/dashboard";
  revalidatePath("/", "layout");
  redirect(next);
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
