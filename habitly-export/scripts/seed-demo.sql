-- Demo login for local / class demos
-- Password (plain text): DemoHabitly2026!
-- Run after `pnpm --filter @workspace/db run push`:
--   psql "$DATABASE_URL" -f scripts/seed-demo.sql

INSERT INTO users (email, name, password_hash)
VALUES (
  'demo@habitly.app',
  'Demo User',
  '$2b$10$uw8xfsfNsIMgnh6p0KsoQOakan7CpQmrXXE6Z.2G.yXtOVNsgOiVK'
)
ON CONFLICT (email) DO NOTHING;
