-- Run in the Supabase SQL editor (see Hackathon Master Plan, Build spec).
-- Until this is applied, the server keeps reports and building context in memory (server/repo.js).
-- Also create a public Storage bucket named "photos" for report photos.

-- Role decides which tabs the app shows and which endpoints the user may call
alter table public.profiles
  add column if not exists role text not null default 'resident' check (role in ('resident', 'manager'));

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  building_id text not null default 'demo-building',
  photo_url text,
  scope text not null check (scope in ('own', 'common', 'from_above')),
  note text,
  ai_result jsonb,
  manager_plan jsonb,
  route text check (route in ('diy', 'specialist', 'manager', 'neighbor')),
  status text not null default 'new' check (status in ('new', 'sent', 'in_progress', 'fixed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_inbox_idx on public.reports (building_id, route, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reporters read their own reports" on public.reports;
create policy "reporters read their own reports"
  on public.reports for select using (auth.uid() = reporter_id);

-- Entered once by the домоуправител, fed into the plan prompt
create table if not exists public.building_context (
  building_id text primary key,
  name text,
  address text,
  year int,
  type text,
  pipe_material text,
  valve_location_text text,
  valve_photo_url text,
  panel_location_text text,
  contractors jsonb not null default '[]',
  past_repairs jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.building_context enable row level security;

insert into public.building_context
  (building_id, name, address, year, type, pipe_material, valve_location_text, panel_location_text, contractors, past_repairs)
values (
  'demo-building',
  'Block 12, entrance B (sample)',
  'ul. Sample 12, Lozenets, Sofia',
  1984,
  'panel',
  'Galvanised steel risers, PPR inside most flats',
  'Main water valve in the basement, left of the stairs, behind the blue door',
  'Electrical panel on each landing, key with the manager',
  '[{"name":"Glass & Frames Ltd (sample)","trade":"glazier","phone":"+359 88 000 0005"},{"name":"Plumber Georgiev (sample)","trade":"plumber","phone":"+359 88 000 0001"}]',
  '[{"year":2024,"what":"Replaced stairwell windows on floors 1-4","contractor":"Glass & Frames Ltd (sample)"},{"year":2023,"what":"Replaced basement section of the cold water riser","contractor":"Plumber Georgiev (sample)"}]'
)
on conflict (building_id) do nothing;

-- Realtime for live status on the resident's result screen
do $$ begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
end $$;
