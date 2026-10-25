-- Garages anywhere in Bulgaria, not only Sofia. Run in Supabase after garages.sql:
-- SQL Editor → New query → paste → Run. Safe to run more than once. Restart the server after.
--
-- city: the English name of one of the 27 regional capitals (CITIES in server/garages.js).
-- Existing garages become Sofia. In Sofia, area is one of the five known districts; elsewhere it
-- is the host's own district, or the city name.
alter table public.garages add column if not exists city text not null default 'Sofia';
create index if not exists garages_city_idx on public.garages (city);

-- Two sample garages outside Sofia, so the demo shows another city on the map.
-- "where not exists" makes this safe to run twice (device_key is random, so "on conflict"
-- would not stop duplicates).
insert into public.garages (title, area, city, latitude, longitude, size, covered, price_hour, price_day, access)
select * from (values
  ('Garage near the Old Town (sample)', 'Center', 'Plovdiv', 42.1478, 24.7495, 'medium', true, 2.5, 15, 'manual'),
  ('Garage by the Sea Garden (sample)', 'Center', 'Varna', 43.2043, 27.9196, 'large', true, 3, 18, 'manual')
) as v(title, area, city, latitude, longitude, size, covered, price_hour, price_day, access)
where not exists (select 1 from public.garages g where g.title = v.title);
