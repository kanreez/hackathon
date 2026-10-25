-- Usernames are unique ignoring case. Run in Supabase: SQL Editor → New query → paste → Run.
-- The server already checks before saving; this index is the guard if two people pick the same
-- name at the same moment (the server then picks the next free one).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;
