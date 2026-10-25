# GarageGo

Rent a neighbour's garage by the hour, anywhere in Bulgaria. Say what you need in plain words
("покрит гараж в Лозенец утре от 9 до 13 за джип"), book it, pay, and open the door from your phone.

Built for JA Hack 2026. Live web version: **https://bodom.junioraccelerator.org**

## What it does

**Renters**
- **Search in plain language**, Bulgarian or English. An AI turns the request into filters (city, Sofia district, time, car size, covered) and also reads each garage's title and description, so "гараж със зарядно" finds the one that mentions an EV charger.
- **Book** by the hour or the day. The time picker starts at the current minute, so time someone just freed can be booked.
- **Pay** through a mock checkout. No real money moves (test cards below).
- **Open and close the garage door** from the app while the booking is active. An ESP32 on the door does the rest.
- **Leave early** to free the rest of the time for others. There's no refund.
- **Review** a stay with 1 to 5 stars and a comment.

**Hosts**
- **List a garage** in any of Bulgaria's 27 regional cities:
  - type the address and tap **Find on map**, or tap the map;
  - upload or take a photo;
  - set the free hours and the prices.
- **Hide** a listing for a while, or **delete** it for good. Deleting is refused while bookings are still running.
- **See earnings** and **pair the door's device** using its key.

**Everyone**
- Log in with a username or an email.
- Change the username and the language in Settings. Bulgarian is the default.

## How it fits together

```
 Phone / browser (Expo app)
        │  HTTPS, user's Supabase token
        ▼
 Express server (server/) ──► Supabase: auth, Postgres, Storage (garage photos)
        │        │
        │        ├──► AI search: Claude Haiku → Gemini Flash-Lite → Gemini → OpenAI (first that answers)
        │        └──► OpenStreetMap Nominatim (address search, via one rate-limited queue)
        ▲
        │  polls every 300 ms with its device key
 ESP32 on the garage door (firmware/garage_bridge)
```

The server is the only authority:
- **Prices:** it sets the price; the app never sends an amount.
- **Payments:** it decides whether a booking is paid.
- **Door:** it only queues a door command for a renter whose paid booking covers right now.
- **Device keys:** renters never see a garage's device key, and the phone never talks to the ESP32.

**AI search safety:** the user's request and the hosts' listing text are both treated as untrusted data. They're cleaned, fenced off in the prompt, and checked against a strict schema. Off-topic requests get a fixed hint instead of an AI answer.

## Project layout

```
src/app/              Screens (Expo Router)
  (auth)/             Log in, sign up
  (tabs)/index.tsx    Find: AI search, list and map
  (tabs)/bookings.tsx My bookings: door panel, tickets, leave early, reviews
  (tabs)/profile.tsx  Profile
  garage/[id].tsx     Garage page: details, reviews, time picker, pay
  host/index.tsx      Your garages: hide, delete, earnings, device pairing
  host/new.tsx        List or edit a garage: city, address search, map pin, photo
  settings.tsx        Username and language
src/components/       UI pieces (map/, CityPicker, PhotoField, DoorPanel, PaySheet, Stars...)
src/i18n/             en.ts and bg.ts (every string in both), errors.ts (server messages)
src/services/         API calls to the server
server/               Express API: server.js (routes), garages.js (rules + AI prompts),
                      repo.js (Supabase, or memory before the tables exist), geocode.js,
                      photos.js, usernames.js, payments/ (mock provider, pricing)
supabase/             SQL to run in the Supabase SQL editor
firmware/             ESP32 door bridge (Arduino), runs in Wokwi or on a real board
```

## Setup

You need Node 22.13 or newer, a Supabase project, and at least one AI key (Anthropic, Gemini or OpenAI).

1. **Install** the dependencies:

   ```bash
   npm install
   ```

2. **App settings:** copy `.env.example` to `.env` in the project root. Fill in:
   - the Supabase URL;
   - the publishable (anon) key. Never use the secret key here.

3. **Server settings:** copy `server/.env.example` to `server/.env`. Fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the secret key);
   - at least one of `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`.

   Share the secret values privately, never through a public place.

4. **Database:** in Supabase, open the SQL editor and run these in order:
   1. a `profiles` table, if your project doesn't have one yet:

      ```sql
      create table if not exists public.profiles (
        id uuid primary key references auth.users (id) on delete cascade,
        username text,
        full_name text,
        avatar_url text,
        updated_at timestamptz
      );
      alter table public.profiles enable row level security;
      ```

   2. `supabase/garages.sql`: garages, bookings, payments, door commands, and seven sample garages in Sofia;
   3. `supabase/reviews.sql`;
   4. `supabase/usernames.sql`;
   5. `supabase/garage-visibility.sql`: hide, delete, leave early;
   6. `supabase/cities.sql`: cities, plus sample garages in Plovdiv and Varna.

   **Notes:**
   - Until the tables exist, the server runs on built-in sample data kept in memory, so the app works straight away.
   - The photo bucket `garage-photos` is created by the server on the first upload.

## Run

Two terminals, both in the project root:

```bash
npm run server        # API on port 3000
```

```bash
npx expo start -c     # the app: press w for web, or scan the QR code with Expo Go
```

- **Phone:** a phone on the same Wi-Fi finds the server on your PC by itself. If Windows asks whether Node may use the network, allow it on private networks.
- **After changing `.env`:** restart with `npx expo start -c`.
- **After changing anything in `server/`:** restart `npm run server`.
- **Adding packages:** use `npx expo install <package>`, so the versions match Expo SDK 58.

## Try it

- **Search:** try `гараж със зарядно`, `покрит гараж в Лозенец утре от 9 до 13 за джип`, `гараж в Пловдив утре` or `garage for a van with a roof box`.
- **Pay:** with the demo wallet, or one of these test cards:

  | Card | Result |
  |---|---|
  | `4242 4242 4242 4242` | paid |
  | `4000 0000 0000 0002` | declined |
  | `4000 0000 0000 9995` | insufficient funds |
  | `4000 0000 0000 3220` | asks you to confirm in the "bank app" |

- **Door without hardware:**

  ```bash
  node server/fake-device.js
  ```

  This pretends to be the ESP32 of the sample garage "Covered garage by Pirogov". Book that garage for now, pay, and tap **Open** in My bookings. Use `FAIL=1` to test the error state.
- **Your own garage's door:** run `node server/fake-device.js <device key>`. The key is shown under **Pair a device** in Your garages.

## The door (ESP32)

`firmware/garage_bridge/garage_bridge.ino` polls `GET /api/device/commands` with its device key. When a command arrives, it clicks a relay wired to the opener's wall button, then reports back with `POST /api/device/ack`.

- **In the Wokwi simulator:**
  1. Run `cloudflared tunnel --url http://localhost:3000`.
  2. Put the `https://….trycloudflare.com` address it prints in `SERVER_URL`.
  3. Paste the sketch and `diagram.json` into Wokwi.
- **On a real board:**
  1. Put your 2.4 GHz Wi-Fi and `http://<server PC IP>:3000` (or the deployed URL) in the sketch.
  2. Wire relay `IN` to GPIO 4, and the relay's COM/NO to the opener's button terminals.
- **Demo key:** the sample garages use `dev-door-lagera-1` and `dev-door-krasno-2`.

## Deploy

The live site runs on **kuso**, the JA Hack hosting.
- **Source:** it builds from the `main` branch of `ja-hack-2026/bodom`; every push there redeploys.
- **One container:** the `Dockerfile` builds the web version of the app (`expo export`), and the Express server serves both it and the API from the same address.
- **Settings:** the server's keys and the two `EXPO_PUBLIC_SUPABASE_*` values are set on the kuso service. The full deploy guide is in that repo's `AGENTS.md`.

## Checks

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

## Tech

- **App:** Expo SDK 58, Expo Router, React Native 0.88, react-native-maps (phone) and Leaflet (web).
- **Server:** Express 5, Supabase (auth, Postgres, Storage).
- **AI:** Claude Haiku 5.5 with Gemini and OpenAI as fallbacks.
- **Address search:** OpenStreetMap Nominatim.
- **Door:** an ESP32 running Arduino.
