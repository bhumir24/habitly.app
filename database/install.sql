-- ============================================================
-- HABITLY — One-shot install (schema + RLS policies).
-- Copy/paste this ENTIRE file into the Supabase SQL editor and click Run.
-- (Safe to re-run: everything is idempotent.)
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
-- TABLES
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  avatar_url      text,
  timezone        text default 'UTC',
  energy_baseline energy_level default 'medium',
  life_mode       life_mode default 'flexible',
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.onboarding_responses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  goals            text[] not null default '{}',
  availability_min int not null default 30,
  routine          jsonb not null default '{}'::jsonb,
  energy_level     energy_level not null default 'medium',
  life_mode        life_mode not null default 'flexible',
  blockers         text[] not null default '{}',
  preferred_times  time_of_day[] not null default '{}',
  notes            text,
  created_at       timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  description      text,
  purpose          text,
  category         habit_category not null default 'other',
  frequency        habit_frequency not null default 'daily',
  custom_days      int[] default null,
  preferred_time   time_of_day not null default 'any',
  scheduled_at     time,
  duration_minutes int not null default 10,
  difficulty       difficulty not null default 'easy',
  fallback_habit   text,
  is_active        boolean not null default true,
  source           text default 'ai',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists habits_user_active_idx on public.habits(user_id, is_active);

create table if not exists public.habit_logs (
  id              uuid primary key default gen_random_uuid(),
  habit_id        uuid not null references public.habits(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          habit_log_status not null,
  completion_date date not null default (now() at time zone 'utc')::date,
  mood            int,
  blocker_note    text,
  created_at      timestamptz not null default now(),
  unique(habit_id, completion_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, completion_date desc);

create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  habit_id      uuid not null references public.habits(id) on delete cascade,
  remind_at     time not null,
  channel       text not null default 'in_app',
  enabled       boolean not null default true,
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       coach_role not null,
  content    text not null,
  context    jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_created_idx on public.coach_messages(user_id, created_at desc);

create table if not exists public.weekly_reports (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  week_start            date not null,
  summary_json          jsonb not null default '{}'::jsonb,
  ai_insight            text,
  recommended_next_step text,
  created_at            timestamptz not null default now(),
  unique(user_id, week_start)
);

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade unique,
  tier        plan_tier not null default 'free',
  started_at  timestamptz not null default now(),
  renews_at   timestamptz,
  provider    text,
  provider_id text
);

-- ------------------------------------------------------------
-- TRIGGERS
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

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.profiles             enable row level security;
alter table public.onboarding_responses enable row level security;
alter table public.habits               enable row level security;
alter table public.habit_logs           enable row level security;
alter table public.reminders            enable row level security;
alter table public.coach_messages       enable row level security;
alter table public.weekly_reports       enable row level security;
alter table public.subscriptions        enable row level security;

-- profiles
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Generic owner-only policies for the rest
do $$
declare
  t text;
begin
  foreach t in array array[
    'onboarding_responses','habits','habit_logs',
    'reminders','coach_messages','weekly_reports','subscriptions'
  ]
  loop
    execute format('drop policy if exists "%s owner all" on public.%I;', t, t);
    execute format(
      'create policy "%s owner all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t
    );
  end loop;
end $$;

-- ✅ Done. Tables created + RLS enabled.
