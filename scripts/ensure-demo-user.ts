/**
 * Creates the shared demo user in your hosted auth (one-time per project).
 *
 * Usage (from repo root, with .env.local loaded):
 *   npx tsx scripts/ensure-demo-user.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createAdminClient } from "../lib/supabase/admin";

const DEMO_EMAIL = process.env.DEMO_LOGIN_EMAIL ?? "demo@habitly.app";
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? "DemoHabitly2026!";

async function main() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo User" },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || error.status === 422) {
        console.log(`Demo user already exists (${DEMO_EMAIL}).`);
        process.exit(0);
      }
      console.error(error);
      process.exit(1);
    }

    console.log(`Created demo user: ${DEMO_EMAIL}`);
    console.log("Enable DEMO_LOGIN=true in .env.local and use “Continue as demo” on /login.");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

void main();
