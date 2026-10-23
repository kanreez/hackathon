-- Example table for src/services/items.ts (used when USE_MOCK = false).
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- Rename "items" and the columns to fit the hackathon theme; keep the Item type in
-- src/constants/mockData.ts matching the columns.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  description text not null default '',
  price numeric not null default 0,
  category text not null default 'food',
  image text not null default '',
  rating numeric not null default 0,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

-- Everyone who is logged in can read all items
create policy "items are readable by signed-in users"
  on public.items for select
  to authenticated
  using (true);

-- Users can only create, edit and delete their own items
create policy "users insert their own items"
  on public.items for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own items"
  on public.items for update
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own items"
  on public.items for delete
  to authenticated
  using (auth.uid() = user_id);

-- Storage for src/services/storage.ts: a public "images" bucket where users
-- can upload only into their own folder (<user id>/...)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "anyone can view images"
  on storage.objects for select
  using (bucket_id = 'images');
