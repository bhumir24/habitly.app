-- ============================================================
-- Personalized Habit Tracker — Schema
-- Postgres / Supabase
-- Run via: supabase db push  OR  paste into Supabase SQL editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
do $$ begin
  create type life_mode as enum ('student','working_pro','parent','athlete','recovery','flexible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type energy_level as enum ('low','medium','high','variable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type habit_category as enum ('health','mind','productivity','learning','social','sleep','nutrition','movement','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type habit_frequency as enum ('daily','weekdays','weekends','custom','3x_week','5x_week');
exception when duplicate_object then null; end $$;

do $$ begin
  create type time_of_day as enum ('early_morning','morning','midday','afternoon','evening','night','any');
exception when duplicate_object then null; end $$;

do $$ begin
  create type difficulty as enum ('micro','easy','medium','hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type habit_log_status as enum ('completed','skipped','modified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free','premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type coach_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- profiles — mirrors auth.users with extra fields
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  avatar_url    text,
  timezone      text default 'UTC',
  energy_baseline energy_level default 'medium',
  life_mode     life_mode default 'flexible',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- onboarding_responses — raw onboarding answers (source of truth for AI)
-- ------------------------------------------------------------
create table if not exists public.onboarding_responses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  goals            text[] not null default '{}',
  availability_min int not null default 30,               -- daily minutes
  routine          jsonb not null default '{}'::jsonb,    -- { wake, sleep, work_block, etc }
  energy_level     energy_level not null default 'medium',
  life_mode        life_mode not null default 'flexible',
  blockers         text[] not null default '{}',
  preferred_times  time_of_day[] not null default '{}',
  notes            text,
  created_at       timestamptz not null default now(),
  unique(user_id)                                         -- one active onboarding per user
);

-- ------------------------------------------------------------
-- habits
-- ------------------------------------------------------------
create table if not exists public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  description      text,
  purpose          text,
  category         habit_category not null default 'other',
  frequency        habit_frequency not null default 'daily',
  custom_days      int[] default null,                    -- 0=Sun..6=Sat when frequency='custom'
  preferred_time   time_of_day not null default 'any',
  scheduled_at     time,                                  -- optional clock-time
  duration_minutes int not null default 10,
  difficulty       difficulty not null default 'easy',
  fallback_habit   text,                                  -- micro-habit fallback
  is_active        boolean not null default true,
  source           text default 'ai',                     -- ai|user|adapted
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists habits_user_active_idx on public.habits(user_id, is_active);

-- ------------------------------------------------------------
-- habit_logs — one row per completion/skip/modify attempt
-- ------------------------------------------------------------
create table if not exists public.habit_logs (
  id              uuid primary key default gen_random_uuid(),
  habit_id        uuid not null references public.habits(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          habit_log_status not null,
  completion_date date not null default (now() at time zone 'utc')::date,
  mood            int,                                    -- 1..5
  blocker_note    text,
  created_at      timestamptz not null default now(),
  unique(habit_id, completion_date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, completion_date desc);

-- ------------------------------------------------------------
-- reminders
-- ------------------------------------------------------------
create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  habit_id      uuid not null references public.habits(id) on delete cascade,
  remind_at     time not null,                             -- local time
  channel       text not null default 'in_app',            -- in_app|email|push (future)
  enabled       boolean not null default true,
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- coach_messages
-- ------------------------------------------------------------
create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       coach_role not null,
  content    text not null,
  context    jsonb default '{}'::jsonb,                    -- snapshot: mood, blockers, habit ids
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_created_idx on public.coach_messages(user_id, created_at desc);

-- ------------------------------------------------------------
-- weekly_reports
-- ------------------------------------------------------------
create table if not exists public.weekly_reports (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  week_start            date not null,                    -- Monday
  summary_json          jsonb not null default '{}'::jsonb,
  ai_insight            text,
  recommended_next_step text,
  created_at            timestamptz not null default now(),
  unique(user_id, week_start)
);

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade unique,
  tier        plan_tier not null default 'free',
  started_at  timestamptz not null default now(),
  renews_at   timestamptz,
  provider    text,                                       -- stripe|manual
  provider_id text
);

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated on public.profiles;
create trigger profiles_set_updated before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists habits_set_updated on public.habits;
create trigger habits_set_updated before update on public.habits
  for each row execute procedure public.set_updated_at();

-- Auto-create profile + free subscription on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
    on conflict (id) do nothing;
  insert into public.subscriptions (user_id, tier)
    values (new.id, 'free')
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
