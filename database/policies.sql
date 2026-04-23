-- ============================================================
-- Row-Level Security policies
-- Every table is scoped to auth.uid() = user_id / profile.id
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
