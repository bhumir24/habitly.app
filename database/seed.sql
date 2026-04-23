-- ============================================================
-- Optional demo seed
-- Usage: replace :user_id with a real auth.users.id then run.
-- ============================================================

-- \set user_id 'REPLACE-WITH-UUID'

insert into public.onboarding_responses (user_id, goals, availability_min, routine, energy_level, life_mode, blockers, preferred_times, notes)
values (
  :'user_id',
  array['Sleep better','Read more','Exercise 3x/week'],
  45,
  '{"wake":"07:00","sleep":"23:30","work_block":"09:00-18:00"}'::jsonb,
  'medium',
  'working_pro',
  array['Low evening energy','Phone distractions'],
  array['morning','evening']::time_of_day[],
  'Wants a sustainable routine, not perfection.'
)
on conflict (user_id) do nothing;

insert into public.habits (user_id, title, purpose, category, frequency, preferred_time, duration_minutes, difficulty, fallback_habit)
values
  (:'user_id','Morning 10-min walk','Boost morning energy & circadian rhythm','movement','daily','morning',10,'easy','Step outside for 60 seconds of fresh air'),
  (:'user_id','Read 10 pages','Daily learning momentum','learning','daily','evening',15,'easy','Read 1 paragraph'),
  (:'user_id','Strength session','Build baseline strength','health','3x_week','evening',30,'medium','2 min of push-ups & squats'),
  (:'user_id','Lights-out by 23:30','Protect sleep window','sleep','daily','night',2,'micro','Dim all lights 15 min earlier');
