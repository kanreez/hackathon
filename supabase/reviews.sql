-- Reviews for garages. Run in Supabase after garages.sql: SQL Editor → New query → paste → Run.
-- Until this table exists the server keeps reviews in memory (see server/repo.js); within 30 s
-- of running it the server switches over by itself.
--
-- Like the other tables, the app never reads this directly: the Express server (service role)
-- checks that the reviewer really booked and used the garage, and only returns public fields.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages (id) on delete cascade,
  -- One review per booking; null only for the labelled sample reviews below
  booking_id uuid unique references public.bookings (id) on delete cascade,
  renter_id uuid references auth.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  author_name text not null, -- "Maria I.", stored so other renters never see an email
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_garage_idx on public.reviews (garage_id, created_at desc);

alter table public.reviews enable row level security;

-- Labelled sample reviews on the sample garages, so the demo isn't all "No reviews yet"
insert into public.reviews (garage_id, rating, comment, author_name, created_at)
select g.id, v.rating, v.comment, v.author, now() - (v.days || ' days')::interval
from (values
  ('Covered garage by Pirogov (sample)', 5, 'Door opened the second I tapped. Plenty of room for a Golf.', 'Ivan P. (sample)', 3),
  ('Covered garage by Pirogov (sample)', 4, 'Easy to find, a bit tight on the ramp.', 'Maria K. (sample)', 9),
  ('Wide garage with remote door (sample)', 5, 'Wide enough for our van, and dry inside.', 'Georgi D. (sample)', 5),
  ('Small box near the metro (sample)', 4, 'Small but fine for a city car, right by the metro.', 'Elena S. (sample)', 12),
  ('Basement garage, Hladilnika (sample)', 3, 'Host was late with the key, garage itself is good.', 'Nikolay T. (sample)', 7)
) as v(title, rating, comment, author, days)
join public.garages g on g.title = v.title
where not exists (select 1 from public.reviews r where r.author_name = v.author and r.garage_id = g.id);
