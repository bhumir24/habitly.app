# Database

Run the SQL files in this order against your Supabase project (SQL Editor):

1. `schema.sql` — tables, enums, triggers
2. `policies.sql` — Row Level Security
3. `seed.sql` — *optional* demo data. Replace `:user_id` with your own `auth.users.id` first.

All tables are owner-scoped via RLS (`auth.uid() = user_id`). A trigger on `auth.users` inserts a `profiles` row and a `free` subscription automatically.
