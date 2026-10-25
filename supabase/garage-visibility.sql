-- Hiding and deleting garages, and leaving a booking early. Run in Supabase after garages.sql:
-- SQL Editor → New query → paste → Run. Safe to run more than once.
--
-- hidden: off search and the public list, no new bookings; existing bookings keep working.
-- deleted_at: deleted by the host. The row stays so renters' past tickets and the host's
-- earnings still name it; the server treats it as gone everywhere else.
alter table public.garages add column if not exists hidden boolean not null default false;
alter table public.garages add column if not exists deleted_at timestamptz;

-- When the renter ended the booking early (ends_at is moved to that minute; no refund)
alter table public.bookings add column if not exists left_early_at timestamptz;
