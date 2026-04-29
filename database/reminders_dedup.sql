-- Run once in Supabase SQL editor.
-- Removes duplicate reminder rows per habit (keeps the most recently created one),
-- then adds a unique constraint so duplicates can't happen again.

-- Step 1: delete older duplicates, keep latest per (user_id, habit_id)
delete from reminders
where id not in (
  select distinct on (user_id, habit_id) id
  from reminders
  order by user_id, habit_id, created_at desc
);

-- Step 2: add unique constraint
alter table reminders
  add constraint reminders_user_habit_unique unique (user_id, habit_id);
