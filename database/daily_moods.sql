-- Run once in Supabase SQL editor to enable daily mood tracking.

create table if not exists public.daily_moods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mood_date  date not null,
  mood       int  not null check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique(user_id, mood_date)
);

alter table daily_moods enable row level security;

create policy "Users manage own daily moods"
  on daily_moods for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
