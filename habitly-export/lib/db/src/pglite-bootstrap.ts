/** Embedded PGlite schema + demo seed (matches Drizzle pg tables). */
export const PG_LITE_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  goals TEXT[] NOT NULL,
  daily_minutes INTEGER NOT NULL,
  wake_time TEXT NOT NULL,
  sleep_time TEXT NOT NULL,
  work_block TEXT NOT NULL,
  energy_level TEXT NOT NULL,
  life_mode TEXT NOT NULL,
  blockers TEXT[] NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  best_time_of_day TEXT NOT NULL DEFAULT 'morning',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  fallback_micro_habit TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id SERIAL PRIMARY KEY,
  habit_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  mood INTEGER,
  blocker_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coach_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  mood INTEGER,
  blocker_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_insights (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  total_completed INTEGER NOT NULL DEFAULT 0,
  total_skipped INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL NOT NULL DEFAULT 0,
  average_mood REAL,
  top_habit TEXT,
  ai_summary TEXT NOT NULL,
  next_step TEXT NOT NULL,
  chart_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  habit_id INTEGER,
  label TEXT NOT NULL,
  time TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, name, password_hash)
VALUES (
  'demo@habitly.app',
  'Demo User',
  '$2b$10$uw8xfsfNsIMgnh6p0KsoQOakan7CpQmrXXE6Z.2G.yXtOVNsgOiVK'
)
ON CONFLICT (email) DO NOTHING;
`;
