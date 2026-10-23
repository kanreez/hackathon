# Hackathon boilerplate

Expo (Router) + Supabase auth + a small Node/Express backend for AI calls.

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. App env: copy `.env.example` to `.env` in the project root and fill in the Supabase URL and publishable key.

3. Backend env (only needed for AI / `/api/*`): copy `server/.env.example` to `server/.env` and fill in the Supabase URL, the secret key and a Gemini key. Get the secret key privately, never through git.

## Run

Two terminals, both in the project root:

```bash
npm run server          # backend on port 3000
npx expo start -c       # app (press w for web, or scan the QR code with Expo Go)
```

- The app finds the backend on your PC automatically in development, also from a real phone on the same Wi-Fi. If Windows asks whether Node may use the network, allow it on private networks.
- After editing `.env`, always restart with `npx expo start -c`.
- Install packages with `npx expo install <package>`, not `npm install <package>`, so versions match the Expo SDK.

## Hackathon day checklist

1. **Rename the app**: `src/constants/app.ts` (name, tagline) and `name`/`slug` in `app.json`.
2. **Re-skin**: colors, font and radii all live in `src/constants/theme.ts`. Swap the marigold `accent` for the theme's color and you're most of the way there.
3. **Model the data**: rename the `Item` type and `CATEGORIES` in `src/constants/mockData.ts`, then build screens against mock data (`USE_MOCK = true` in `src/services/items.ts`).
4. **Switch to Supabase**: adapt and run `supabase/items.sql`, then set `USE_MOCK = false`.
5. **Give the AI a job**: edit `SYSTEM_PROMPT` and `SUGGESTIONS` in `src/app/(tabs)/ai.tsx`; use `askAIJson()` when a screen needs data back, not text.

## What's included

| Screen | File | What it does |
| --- | --- | --- |
| Log in / Register | `src/app/(auth)/` | Email + password with inline errors |
| Home | `src/app/(tabs)/index.tsx` | Greeting, ask-the-assistant box, quick actions, recent and top rated items |
| Explore | `src/app/(tabs)/explore.tsx` | Search, category chips, "Nearby" sort by distance, pull to refresh, empty states |
| Item detail | `src/app/item/[id].tsx` | Photo, details, open in maps, AI tips, edit, delete |
| Item form | `src/app/item/edit.tsx` | Create (`/item/edit`) and edit (`/item/edit?id=…`), photo, location, validation |
| Assistant | `src/app/(tabs)/ai.tsx` | Chat with Gemini, plain answers or structured JSON |
| Profile | `src/app/(tabs)/profile.tsx` | Avatar upload, name/username, log out |

Building blocks:

```
src/components/   Button, Input, Card, Chip/ChipRow, Header/IconButton, Avatar, ItemRow,
                  StateViews (Loading, EmptyState, ErrorState), Toast (notify), BrandMark
src/constants/    theme.ts (design tokens), app.ts (name), mockData.ts, authStyles.ts
src/hooks/        useAsync (loading/error/data + reload), useRefreshOnFocus
src/services/     db.ts (CRUD for any table), items.ts (mock ↔ Supabase switch),
                  supabase.ts, api.ts (backend calls with the user's token),
                  userService.ts (profiles), storage.ts (image upload)
src/utils/        ai.ts (askAI, askAIJson), location.ts, media.ts (pick/take photo)
server/           server.js: /api/me, /api/ai (Gemini, optional system prompt + JSON mode)
supabase/         items.sql: example table, security policies and the images bucket
```

Useful snippets:

```ts
notify("Saved");                         // toast on web and phone (Alert.alert does nothing on web)
notify(e.message, "error");

const { data, loading, error, reload } = useAsync(() => listRows<Event>("events"), []);

const tips = await askAI("3 tips for...", { system: "You are a coach." });
const { ideas } = await askAIJson<{ ideas: { title: string }[] }>('3 ideas as {"ideas":[{"title":string}]}');
```

## Supabase checklist

- `profiles` table exists (used by `userService.ts`, the Profile screen and `/api/me`).
- Storage bucket `images` exists and is public (created by `supabase/items.sql`).
- For the demo: turn off "Confirm email" (Authentication → Sign In / Providers → Email) and create a demo account.
