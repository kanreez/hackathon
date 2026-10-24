-- Tables for the garage app. Run in Supabase: SQL Editor → New query → paste → Run.
-- Until these exist the server keeps everything in memory (see server/repo.js).
--
-- The app never reads these tables directly: everything goes through the Express server
-- (service role key), which hides each garage's device_key from renters and is the only
-- place that decides whether a booking may open a door. So RLS is on with no client policies.

create extension if not exists btree_gist;

create table if not exists public.garages (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users (id) on delete cascade,
  title text not null,
  area text not null,
  address text,
  latitude double precision,
  longitude double precision,
  size text not null check (size in ('small', 'medium', 'large')),
  covered boolean not null default true,
  price_hour numeric not null check (price_hour > 0),
  price_day numeric not null check (price_day > 0),
  access text not null check (access in ('app', 'manual')),
  image_url text,
  description text check (char_length(description) <= 500),
  -- Weekly hours the garage is free, in Sofia time: [{"day": 0-6 (0 = Sunday), "start": 0-23, "end": 1-24}].
  -- null = free any time. The server checks bookings against it.
  availability jsonb,
  -- Secret the garage's ESP32 is flashed with
  device_key text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

-- For a garages table created before these columns existed
alter table public.garages add column if not exists description text check (char_length(description) <= 500);
alter table public.garages add column if not exists availability jsonb;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages (id) on delete cascade,
  renter_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  mode text not null check (mode in ('hour', 'day')),
  total_price numeric not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  -- Two confirmed bookings of the same garage can never overlap, even if two taps race
  exclude using gist (garage_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'confirmed')
);

create index if not exists bookings_renter_idx on public.bookings (renter_id, starts_at desc);

create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  action text not null default 'open',
  status text not null default 'queued' check (status in ('queued', 'opened', 'error')),
  error text,
  delivered_at timestamptz,
  acked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists device_commands_queue_idx on public.device_commands (garage_id, status, created_at);

alter table public.garages enable row level security;
alter table public.bookings enable row level security;
alter table public.device_commands enable row level security;

-- Seed: 7 garages in Lagera / Krasno Selo / Lozenets, two of them opened from the app.
-- The two app garages use the same dev keys as the in-memory seed, so a flashed ESP32 keeps working.
insert into public.garages (title, area, address, latitude, longitude, size, covered, price_hour, price_day, access, device_key, availability)
values
  ('Covered garage by Pirogov (sample)', 'Lagera', 'ul. Tsar Samuil 110', 42.6879, 23.3009, 'medium', true, 3, 20, 'app', 'dev-door-lagera-1', null),
  ('Wide garage with remote door (sample)', 'Krasno Selo', 'bul. Tsar Boris III 41', 42.6822, 23.2901, 'large', true, 4, 25, 'app', 'dev-door-krasno-2', null),
  ('Small box near the metro (sample)', 'Lagera', 'ul. Dimitar Petkov 12', 42.6851, 23.2982, 'small', true, 2, 12, 'manual', default, null),
  ('Open yard spot, Hristo Botev (sample)', 'Lagera', 'bul. Hristo Botev 64', 42.6905, 23.3041, 'medium', false, 1.5, 9, 'manual', default, '[{"day":1,"start":8,"end":18},{"day":2,"start":8,"end":18},{"day":3,"start":8,"end":18},{"day":4,"start":8,"end":18},{"day":5,"start":8,"end":18}]'),
  ('Basement garage, Hladilnika (sample)', 'Krasno Selo', 'ul. Kozyak 8', 42.6789, 23.2932, 'medium', true, 2.5, 15, 'manual', default, null),
  ('Garage by South Park (sample)', 'Lozenets', 'ul. Krichim 21', 42.6741, 23.3196, 'large', true, 3.5, 22, 'manual', default, null),
  ('Covered spot on Cherni Vrah (sample)', 'Lozenets', 'bul. Cherni Vrah 47', 42.6712, 23.3261, 'small', true, 2, 13, 'manual', default, null)
on conflict (device_key) do nothing;
