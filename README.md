# Habitly — AI-Powered Adaptive Habit Coach

A portfolio-grade MVP of a personalised habit tracker that **plans, adapts, and coaches** based on each user's goals, time, energy, and life mode.

Built with **Next.js 14 (App Router) · TypeScript · Tailwind · shadcn-style UI · Supabase (auth + Postgres + RLS) · Zod · Recharts · OpenAI/Claude abstraction layer** (runs out-of-the-box with a deterministic mock provider — no API key required for the first run).

---

## Why this exists

Most habit trackers assume you're consistent. Real life isn't. Habitly is **failure-friendly by design**:
- Every habit has a 2-minute fallback.
- Missing a streak triggers adaptation, not shame.
- The AI coach references *your* habits and *your* logs — not generic platitudes.
- A weekly report surfaces best windows and one concrete next step.

---

## Folder structure

```text
app/                  # Next.js App Router pages + API routes
  (auth)/             # /login, /signup (public)
  (app)/              # Sidebar layout — protected
    dashboard/
    habit/[id]/
    coach/
    insights/
    settings/
    pricing/
  onboarding/         # 6-step wizard (post-signup)
  plan-review/        # AI plan accept / edit / regenerate
  api/reminders/tick  # Cron endpoint for reminder sweep
  layout.tsx
  page.tsx            # Marketing landing

components/
  ui/                 # Reusable primitives (button, card, select, etc.)
  layout/             # Sidebar, page header
  onboarding/         # Wizard
  plan/               # Plan-review screen
  habit/              # HabitCard, StatCard, AdaptationsPanel, HabitDetail
  coach/              # Chat UI + mood/blocker inputs
  insights/           # Recharts panels + report view
  settings/           # Profile + reminders form
  pricing/            # Tier cards
  auth/               # Login / signup forms

lib/
  supabase/           # Browser, server, middleware clients
  validations.ts      # Zod schemas (shared client + server)
  constants.ts        # Enums + UI-facing option lists
  feature-flags.ts    # Free vs Premium gating
  date.ts             # Date helpers (today, week, scheduling)
  utils.ts            # cn(), initials(), etc.

actions/              # Server Actions (mutations + AI calls)
  auth.ts
  onboarding.ts
  habits.ts
  coach.ts
  insights.ts
  subscriptions.ts

services/             # Pure domain logic — reusable in React Native
  habit-service.ts    # due-today, streaks, weekly summary builder
  adaptation-engine.ts# Rule-based adaptation suggestions
  reminder-service.ts # Scheduling + pluggable NotificationChannel

ai/                   # Provider abstraction (swap mock ↔ OpenAI)
  provider.ts         # `getAIProvider()` reads AI_PROVIDER env
  mock-provider.ts    # Deterministic, context-aware — demo-ready
  openai-provider.ts  # Real OpenAI impl with mock fallback on error
  prompts.ts          # Plan / coach / weekly system prompts

types/                # Framework-free domain types
database/             # SQL: schema, RLS policies, seed
middleware.ts         # Supabase session refresh + route protection
```

The boundary between `services/` (pure), `actions/` (server mutations), and `ai/` (provider-pluggable) is deliberate — it's what makes the business logic reusable in a future React Native client.

---

## Quick start (frontend + backend)

### Fast path — 3 commands

```bash
npm install                    # 1. install deps
cp .env.example .env.local     # 2. env (defaults already point to a working mock AI)
npm run dev                    # 3. boot the app → http://localhost:3000
```

The **landing page + all public routes render immediately** with zero config. Sign-up/dashboard requires a real Supabase project (see step 2 below).

### 1. Install

```bash
npm install
```

### 2. Supabase setup (the backend)

1. Create a free Supabase project — https://supabase.com/dashboard → New project.
2. **Database**: open the SQL editor and paste the entire contents of `database/install.sql` (schema + RLS in one shot). Click **Run**.
3. **Auth**: Authentication → Providers → Email → turn **off** "Confirm email" for local dev (or wire up the confirmation template).
4. Grab your project's URL + anon key + service-role key from Project Settings → API.

### 3. Environment

Open `.env.local` (already created for you) and replace the Supabase values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...     # only for /api/reminders/tick cron

AI_PROVIDER=mock                    # or: openai
OPENAI_API_KEY=                     # only if AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FORCE_PREMIUM=false     # flip true to preview paid features
```

> The app is fully usable with `AI_PROVIDER=mock` — the mock generates a plan, coach replies, and weekly insights that reference real onboarding data, so screenshots look great without any LLM keys.

### 4. Run

```bash
npm run dev
```

Visit http://localhost:3000 → Sign up → Onboarding → Plan review → Dashboard → Coach → Insights.

### If the UI looks “unstyled” (Times New Roman, no spacing)

1. Stop `npm run dev`, delete `.next`, start again: `rm -rf .next && npm run dev`.
2. Hard-refresh the browser (**Cmd+Shift+R**). Make sure the URL is **`http://localhost:…`** (not `file://`).
3. The root layout now includes a tiny **critical CSS** fallback so the page still looks modern even if a CSS chunk fails once.

### Sanity check

Already verified clean on this machine:

- `npm run build` → 13 routes compiled, 0 errors
- `tsc --noEmit` → clean
- `GET /` → 200 (landing)
- `GET /login`, `/signup` → 200 (public)
- `GET /dashboard`, `/pricing` → 307 redirect to `/login?next=…` (auth gated)

---

## Key flows

| Flow | Entry point | What happens |
|---|---|---|
| Sign up | `app/(auth)/signup` | Supabase email/password → DB trigger creates `profiles` + free `subscriptions` row → redirect to `/onboarding`. |
| Onboarding | `app/onboarding` | 6-step wizard → `actions/onboarding.saveOnboarding` → writes `onboarding_responses`, flags profile as onboarded. |
| Plan generation | `app/plan-review` | `ai/provider.generatePlan()` with user context → `acceptPlan()` inserts habits + seeds reminders at ideal times. |
| Daily tracking | `app/(app)/dashboard` | `services/habit-service` computes due-today, streaks, 7-day rate. `HabitCard` → `logHabit` server action (complete / skip + blocker). |
| Adaptation | Dashboard sidebar | `services/adaptation-engine.deriveAdaptations()` → one-tap `applyAdaptation` patches the habit. |
| AI Coach | `app/(app)/coach` | Full chat UI with mood + blocker chips → `sendCoachMessage` → provider picks user-context-aware reply. |
| Weekly insights | `app/(app)/insights` | `buildWeeklySummary()` → AI paragraph + next-week step → persisted to `weekly_reports`. |
| Reminders cron | `app/api/reminders/tick` | Call from Vercel Cron every minute. Uses service-role key + pluggable `NotificationChannel`. |

---

## AI provider architecture

Everything AI-related routes through one interface:

```ts
// ai/provider.ts
export interface AIProvider {
  generatePlan(…): Promise<GeneratedPlan>
  coachReply(…):   Promise<string>
  adapt(…):        Promise<Adaptation[]>
  weeklyInsight(…):Promise<{ insight; next_step }>
}
```

Swap the impl via `AI_PROVIDER=mock | openai`. A third (`anthropic-provider.ts`) is a ~30-line addition mirroring `openai-provider.ts`.

The real provider **always falls back to the mock** on network/parsing errors — the app never crashes in front of a user because of a flaky LLM response.

---

## Free vs Premium

Gating lives in `lib/feature-flags.ts` (`canUse(tier, feature)`). MVP decisions:

| Feature | Free | Premium |
|---|---|---|
| Onboarding + starter plan | ✅ | ✅ |
| Daily tracking + streaks | ✅ | ✅ |
| Weekly summary | ✅ | ✅ |
| Max active habits | 5 | unlimited |
| Coach messages / day | 10 | unlimited |
| Advanced coach (memory, proactive) | — | ✅ |
| Deep adaptation (recovery weeks, progressions) | — | ✅ |
| Detailed reports (best windows, blockers, mood) | — | ✅ |
| Smart reminders | — | ✅ |

Billing is a **local toggle** for the MVP (`/pricing` flips `subscriptions.tier`). Wire it to a Stripe webhook in production.

---

## Design decisions / assumptions

- **Supabase-first**: no Prisma. Schema + RLS ships as two SQL files you can paste into the SQL editor.
- **Server Actions over REST**: mutations colocated with the pages that trigger them.
- **Pure services layer**: every business rule (streak math, weekly summary, adaptation) lives in `services/` with zero framework imports — reusable in React Native.
- **Mock AI is first-class**: if you don't plug in a key, the app still *feels* coached. The mock reads the actual onboarding fields and log history.
- **Failure-friendly data model**: every habit has a `fallback_habit`. Logs include a `blocker_note`. Weekly reports include top blockers.
- **Timezone**: stored on `profiles`, used for reminder clock times. MVP ignores DST edge cases (document + iterate).
- **Reminders**: in-app only in MVP. The `NotificationChannel` interface + `/api/reminders/tick` cron are ready — drop in FCM/APNs/Resend by implementing one interface.
- **Error boundaries**: server actions return `{ ok, error }` tuples instead of throwing — easy for the UI to render inline.

---

## Future Improvements

Short list of what a senior reviewer would expect next:

**Product**
- Real push notifications (Expo Push / FCM / APNs) via the existing `NotificationChannel` interface.
- Morning "plan the day" and evening "reflect" flows (not just ad-hoc coach chat).
- Habit history heatmap (GitHub-style) on the habit detail page.
- Social accountability — optional shareable weekly reports.
- Import/export of onboarding & plans.

**AI**
- Anthropic provider (`anthropic-provider.ts`) — 30-minute add.
- Streaming coach replies (Vercel AI SDK) with typing indicator tied to stream events.
- RAG on the user's logs for the coach (top-k log snippets) instead of the current window.
- Evaluation harness: golden coach transcripts + automated regression on prompt changes.

**Platform**
- React Native client — reuse `types/`, `services/`, `ai/` wholesale; only `app/` and `components/` need RN equivalents.
- Stripe billing replacing the dev-only tier toggle; webhook into `subscriptions`.
- Supabase Edge Functions for scheduled weekly report generation (Sunday nights).
- OpenTelemetry + a structured logger (pino/sentry) around AI calls + server actions.
- Playwright e2e covering: signup → onboarding → plan accept → dashboard log → weekly report.
- Per-user timezone DST handling and iCal export of the daily plan.

**UX polish**
- Command palette (⌘K) for quick logging.
- Dark-mode theme toggle wired to `next-themes`.
- Skeleton states + optimistic mutations for every list.
- Progressive onboarding ("you can skip this step for now").

---

## License

MIT — go build.
