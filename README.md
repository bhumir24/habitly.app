# Habitly

Habitly is a personalized habit coaching app that helps users plan routines, track progress, and stay consistent with practical daily actions.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Reusable UI components
- Server actions for app flows

## Project Structure

```text
app/                  # Routes, layouts, pages, API endpoints
  (auth)/             # Public auth pages
  (app)/              # Protected app experience
  onboarding/         # Onboarding flow
  plan-review/        # Plan confirmation flow
  api/                # Server endpoints

components/           # Feature + shared UI components
  auth/
  coach/
  habit/
  insights/
  layout/
  onboarding/
  plan/
  pricing/
  settings/
  ui/

actions/              # Server actions (mutations + flow logic)
ai/                   # AI provider layer and prompts
services/             # Core business logic
lib/                  # Utilities, constants, validation, shared helpers
database/             # SQL files for schema and setup
types/                # Shared app/domain types
```

## Recent updates (from Git history)

These landed on `main` recently:

- **AI coach:** Replies adapt more naturally to what the user asks.
- **Coach chat:** Conversation persists while you move around the app; it only clears when you use **Clear** (not on every navigation).
- **Coach UI:** Save / Clear actions and clearer navigation hints on the coach page.

## Getting Started

### 1) Clone

```bash
git clone https://github.com/bhumir24/habitly.app.git
cd habitly.app
```

### 2) Install

```bash
npm install
```

### 3) Environment

```bash
cp .env.example .env.local
```

Fill in values in `.env.local` based on your local setup.

### 4) Run

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

After `npm install`, run `npm run build` once if you want to confirm everything compiles before demos.

### Demo login (optional)

For a shared **demo@habitly.app** account on `/login` (no manual sign-up):

1. Put real project URL + keys in `.env.local` (see above), plus **`SUPABASE_SERVICE_ROLE_KEY`**.
2. Run **`database/install.sql`** once in the SQL editor if you have not already.
3. Create the demo user (one-time per project):

   ```bash
   npm run seed:demo-user
   ```

4. In **`.env.local`** set **`DEMO_LOGIN=true`**, restart **`npm run dev`**.
5. Open **`/login`** and click **Continue as demo**.

Default password is **`DemoHabitly2026!`** (override with `DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_PASSWORD` in `.env.local` if you change it).

Do **not** enable `DEMO_LOGIN` on a public production site.

## Team Usage

- Pull latest changes before starting work: `git pull`
- Create your own branch for changes: `git checkout -b your-branch-name`
- Run the app locally and test before pushing
- Open a Pull Request for review

## Main User Flow

1. Sign up / log in
2. Complete onboarding
3. Review and accept plan
4. Track habits from dashboard
5. Use coach for support
6. Review weekly insights

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run production server

## Notes

- Keep secrets only in `.env.local`
- Do not commit personal credentials
- Keep feature work in small PRs for easier review

## License

MIT
