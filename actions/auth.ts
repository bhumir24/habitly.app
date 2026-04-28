"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signUpSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean } | null;

function getSupabaseEnvError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL in .env.local. Copy .env.example to .env.local and set your Supabase project URL (Dashboard → Settings → API).";
  }
  if (!key) {
    return "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. Add the anon public key from Supabase → Settings → API.";
  }
  if (/your-project\.supabase\.co/i.test(url) || url.includes("YOUR-PROJECT")) {
    return "NEXT_PUBLIC_SUPABASE_URL is still a placeholder. Replace it with your real https://xxxxx.supabase.co URL.";
  }
  if (/YOUR-ANON-KEY/i.test(key)) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is still a placeholder. Paste the real anon key from Supabase → Settings → API.";
  }
  return null;
}

function mapAuthNetworkError(message: string): string {
  if (/fetch failed|failed to fetch|ENOTFOUND|ECONNREFUSED|certificate/i.test(message)) {
    return (
      "Cannot reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, " +
      "confirm the project is active in the Supabase dashboard, then restart `npm run dev`. " +
      "If a teammate’s app works, use the same two values from their .env.local."
    );
  }
  return message;
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    full_name: form.get("full_name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const envErr = getSupabaseEnvError();
  if (envErr) return { error: envErr };

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.full_name } },
    });
    if (error) return { error: error.message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthNetworkError(msg) };
  }
  redirect("/onboarding");
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Invalid credentials" };

  const envErr = getSupabaseEnvError();
  if (envErr) return { error: envErr };

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: error.message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthNetworkError(msg) };
  }

  const next = (form.get("next") as string) || "/dashboard";
  revalidatePath("/", "layout");
  redirect(next);
}

const DEMO_EMAIL_DEFAULT = "demo@habitly.app";
const DEMO_PASSWORD_DEFAULT = "DemoHabitly2026!";

/** One-click demo session. Only when DEMO_LOGIN=true (local / staging). */
export async function continueAsDemo(_: ActionState, __: FormData): Promise<ActionState> {
  if (process.env.DEMO_LOGIN !== "true") {
    return { error: "Demo login is not enabled on this server." };
  }
  const envErr = getSupabaseEnvError();
  if (envErr) return { error: envErr };

  const email = process.env.DEMO_LOGIN_EMAIL ?? DEMO_EMAIL_DEFAULT;
  const password = process.env.DEMO_LOGIN_PASSWORD ?? DEMO_PASSWORD_DEFAULT;

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/invalid login|invalid credentials|email not confirmed/i.test(error.message)) {
        return {
          error:
            "Demo user is missing or the password does not match. From the repo root run: npx tsx scripts/ensure-demo-user.ts",
        };
      }
      return { error: error.message };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthNetworkError(msg) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
