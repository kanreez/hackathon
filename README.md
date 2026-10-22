# Hackathon boilerplate

Expo (Router, NativeWind) + Supabase auth + a small Node/Express backend for AI calls.

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

## Structure

```
src/app/          screens (file-based routing): (auth) login/register, (tabs) home/explore/profile/settings
src/components/   Button, Card, Input, ScreenWrapper
src/constants/    theme.ts (colors, spacing, typography), mockData.ts
src/context/      AuthContext (useAuth: user, login, signup, logout)
src/services/     supabase.ts, api.ts (calls the backend with the user's token), userService.ts (profiles), storage.ts (image upload)
src/utils/        ai.ts (askAI), location.ts, media.ts (pick/take photo)
server/           server.js: /api/me, /api/ai (Gemini)
```

## Supabase checklist

- `profiles` table exists (used by `userService.ts` and `/api/me`).
- Storage bucket `images` exists (used by `storage.ts`); make it public for public URLs.
- For the demo: turn off "Confirm email" (Authentication → Sign In / Providers → Email) and create a demo account.
