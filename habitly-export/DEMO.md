# Demo login — Habitly (Replit export)

## Demo account

| Field | Value |
|--------|--------|
| **Email** | `demo@habitly.app` |
| **Password** | `DemoHabitly2026!` |

Create this user **once** in Postgres (after `pnpm --filter @workspace/db run push`):

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/habitly"
psql "$DATABASE_URL" -f scripts/seed-demo.sql
```

*(Or sign up manually in the UI with any email — no vendor API keys needed.)*

---

## Run backend + frontend

**1 — API** (from repo root `habitly-export/`):

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/habitly"
export PORT=8080
pnpm --filter @workspace/api-server run dev
```

**2 — UI** (second terminal, from repo root):

```bash
cd habitly-export
pnpm run dev:ui
```

*(Same as `cd artifacts/habitly && PORT=5173 BASE_PATH=/ pnpm run dev` — defaults are baked into `dev:ui`.)*

**3 — Open** `http://localhost:5173` → **Log in** with the demo email/password above.

---

## Notes

- Install deps once: `npx pnpm@9 install` from `habitly-export/` (root `package.json` rejects plain `npm`).
- Session cookies are **Lax + non-Secure in development** so localhost works; production still uses **Secure + None** when `NODE_ENV=production`.

---

## “Neither frontend nor backend works” — checklist

1. **Use pnpm** in `habitly-export/` (not `npm install` at the root — it will error).

2. **Postgres must be running** and **`DATABASE_URL` set** before the API starts, or the process exits when it loads `@workspace/db`.

   ```bash
   cd habitly-export
   docker compose up -d
   export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/habitly"
   pnpm --filter @workspace/db run push
   ```

3. **API port must be `8080`** — the Vite dev server proxies `/api` → `http://localhost:8080`. If you change the API port, change `vite.config.ts` proxy too.

4. **Frontend** — open **`http://127.0.0.1:5173`** (defaults: `PORT=5173`, `BASE_PATH=/`). You no longer need to export `PORT`/`BASE_PATH` for local dev.

5. **Re-export was missing `build.mjs`** — the API `dev` script now uses **`tsx watch`** so you don’t need a production build to develop.

6. If the UI loads but login fails with network errors, the **API isn’t running** or isn’t on port **8080**.
