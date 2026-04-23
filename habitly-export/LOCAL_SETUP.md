# Habitly (Replit export) — run on your machine

This folder is a **pnpm workspace** monorepo:

| Package | Path | What it is |
|--------|------|------------|
| `@workspace/habitly` | `artifacts/habitly` | **Vite + React** SPA (Tailwind v4). Needs `PORT` + `BASE_PATH`. Proxies `/api` → `http://localhost:8080` in dev. |
| `@workspace/api-server` | `artifacts/api-server` | **Express 5** API under `/api`. Needs `PORT` + `DATABASE_URL`. |
| `@workspace/db` | `lib/db` | **Drizzle + PostgreSQL** schema. Run `pnpm --filter @workspace/db run push` after DB exists. |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI + Orval codegen (optional unless you change the API). |

**Important:** the root `package.json` **refuses `npm install`** — you must use **pnpm** (same as Replit).

---

## 0) Prerequisites

- **Node.js** 20+ (Replit doc says 24; 20 LTS usually works — use 22+ if you hit issues).
- **pnpm**: `corepack enable && corepack prepare pnpm@latest --activate`
- **PostgreSQL** running somewhere (Docker below, or Neon/Supabase free Postgres URL).

---

## 1) Install dependencies

From **inside** `habitly-export/`:

```bash
pnpm install
```

---

## 2) Create the database

**Easiest — Compose file in this repo:**

```bash
cd habitly-export
docker compose up -d
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/habitly"
```

Or a one-off container:

```bash
docker run --name habitly-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=habitly -p 5432:5432 -d postgres:16
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/habitly"
```

Push schema:

```bash
pnpm --filter @workspace/db run push
```

Optional **demo user** (fixed email/password — see `DEMO.md`):

```bash
psql "$DATABASE_URL" -f scripts/seed-demo.sql
```

---

## 3) Run API + UI (two terminals)

**Terminal A — API (port 8080 matches Vite proxy):**

```bash
cd habitly-export
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/habitly"
export PORT=8080
pnpm run dev:api
```

**Terminal B — Vite:**

```bash
cd habitly-export
pnpm run dev:ui
```

Open **http://localhost:5173** (default UI port).

---

## 4) “I have no API keys”

That’s OK for this stack:

- **Auth** is **email + password + session token** in your DB (no Clerk/Supabase Auth required).
- **AI** in the API is **rule/template based** in `artifacts/api-server/src/lib/ai.ts` (no OpenAI key required for the MVP path unless Replit added optional calls elsewhere — check `ai.ts` if you add LLM later).

You **only** need `DATABASE_URL` (+ the two `PORT`/`BASE_PATH` vars for the UI).

---

## 5) Hosting (high level)

You’re deploying **two** processes:

1. **API** → Railway, Render, Fly.io, or a VPS. Set `DATABASE_URL` and `PORT` (often provided by host, e.g. `8080`).
2. **Frontend** → Vercel / Netlify / Cloudflare Pages **static** build output: `artifacts/habitly/dist/public` after `pnpm --filter @workspace/habitly run build`.

**Production API URL:** Vite dev uses a proxy; **production** must call your real API. Options:

- Put API and UI on the **same origin** behind one reverse proxy (`/api` → Express, `/` → static), **or**
- Set a public API base URL in the client (if the generated client supports `setBaseUrl` — see `lib/api-client-react`) and enable CORS on Express for your UI origin.

If you want, we can wire `VITE_API_BASE_URL` + `main.tsx` in a follow-up once you pick a host.

---

## 6) Troubleshooting

| Problem | Fix |
|--------|-----|
| `Use pnpm instead` | Don’t use npm/yarn in this repo root. |
| `PORT environment variable is required` | Export `PORT` for **both** Vite and the API (see above). |
| `BASE_PATH environment variable is required` | `export BASE_PATH=/` for local. |
| `DATABASE_URL must be set` | Export `DATABASE_URL` before starting the API (and before `db push`). |
| `pnpm install` slow / blocked | `pnpm-workspace.yaml` enforces **minimumReleaseAge** — intentional; wait or use Replit’s registry mirror. |

---

## 7) Demo login (fixed email + password)

See **`DEMO.md`** — includes `demo@habitly.app` / `DemoHabitly2026!` and the `psql` one-liner to seed after `db push`.

---

## 8) What to send your Cursor agent next

Zip this folder **or** open it in Cursor and say: “merge this `habitly-export` app with the existing Next.js `App-ap`” *only if* you want one repo — otherwise keep them separate and deploy this monorepo on its own.
