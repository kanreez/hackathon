# Google Maps Feature Implementation Brief
## GarageGo: garage rental app with phone-opened doors

This brief describes the maps work still to do in this repository. It is written for an AI coding assistant and has been checked against the code on branch `work/from-boilerplate-fixes` (Expo SDK 58, React Native 0.88). Paths and names below are the real ones.

## 1. What already exists (do not rebuild)

| Piece | Where | State |
|---|---|---|
| Garage coordinates | `Garage.latitude` / `Garage.longitude` in `src/types/garage.ts` (`number \| null`), columns in `supabase/garages.sql` | Done. All 7 seed garages have coordinates, both in the SQL seed and the in-memory seed in `server/repo.js`. Host-created garages get coordinates from `getCurrentLocation()` in `src/app/host/new.tsx`, or `null` if the host skipped it. |
| Distance | `distanceKm()` and `getCurrentLocation()` in `src/utils/location.ts` | Done. |
| Distance sorting | `sortByDistance()` in `src/app/(tabs)/index.tsx` | Done. Sorts from the searched area's center, else from the user's location; garages without coordinates sort last with no distance shown. Denied permission is caught and the list keeps the server's order. |
| Area centers | `AREAS` in `server/garages.js`; `/api/garages/search` returns `center` | Done. Five Sofia areas with coordinates. |
| AI search | `POST /api/garages/search` in `server/server.js` → `SearchResult` (`filters`, `from_utc`, `to_utc`, `center`, `garages`) | Done. Uses whichever provider `AI_PROVIDER` sets in `server/.env` (currently Anthropic), not only Gemini. The server already applies the filters; the client receives only matching garages. |
| Open in maps | `openInMaps()` exported from `src/components/GarageRow.tsx`; used by the row's navigate action and the "Open in maps" button in `src/app/garage/[id].tsx` | Partly done. It opens a Google Maps **search** URL, not directions, and errors are not caught. |
| Mock data | No `USE_MOCK` flag. `server/repo.js` falls back to an in-memory store when the Supabase tables are missing. | Works without the database. |

Screens: three tabs, **Find** (`src/app/(tabs)/index.tsx`), **Bookings**, **Profile**. Garage detail and booking is `src/app/garage/[id].tsx` (not `item/[id].tsx`, which no longer exists). Toasts: `notify(message, "error")` from `src/components/Toast.tsx`.

## 2. Goal

1. Directions to a garage open in Google Maps (turn-by-turn stays in Google Maps).
2. On the Find screen, the same garages that are in the list can also be seen as markers on an embedded map (phone only).
3. Tapping a marker selects that garage and leads to its detail screen through the existing booking flow.

## 3. Work to do, in order

### Priority 1: Directions instead of search (required)

- Move `openInMaps` out of `GarageRow.tsx` into `src/utils/maps.ts` as `openDirections(garage)`, and update both callers (`GarageRow.tsx`, `src/app/garage/[id].tsx`).
- With valid coordinates use the directions URL:
  `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`
  Validate first: both finite, latitude within ±90, longitude within ±180.
- Without valid coordinates, use `destination=` with the URL-encoded `"<address or title>, <area>, Sofia"`. Sofia is acceptable because every area in `AREAS` is in Sofia; keep it in one constant so it is easy to change.
- `Linking.openURL` returns a promise. Catch failures inside `openDirections` and show `notify("Couldn't open Google Maps", "error")`, so every caller gets the same handling. Do not swallow errors silently.
- Rename the button in `garage/[id].tsx` to **Directions**; update the row action's accessibility label to match.

### Priority 2: Embedded map on the Find screen (do after Priority 1 works)

Library: **`react-native-maps`**. The SDK 58 docs list it as supported in Expo Go with no extra setup. Do not use `expo-maps`; it needs a development build for Google Maps and iOS 17+.

```bash
npx expo install react-native-maps
```

Constraints that matter here:
- **No web support.** The app is also run with `expo start --web`. Use platform files: `src/components/GarageMap.native.tsx` (the real map) and `src/components/GarageMap.tsx` (web: renders nothing). Hide the Map/List toggle on web (`Platform.OS === "web"`).
- **Provider.** Keep the default provider (Apple Maps on iOS, Google Maps on Android). Do not pass `PROVIDER_GOOGLE`; it needs extra iOS setup and gains nothing for the demo.
- **API key.** Not needed in Expo Go. For an EAS/standalone Android build, add the `react-native-maps` config plugin to `app.json` with `androidGoogleMapsApiKey` read from an env var, and rebuild. Never commit the key.
- Test in Expo Go on a real phone before polishing. If it is unreliable, ship Priority 1 only and drop this section.

Component contract (match existing types):

```tsx
// src/components/GarageMap.native.tsx
type Props = {
  garages: Garage[];                 // the same array the list renders
  center: Coords | null;             // result.center ?? me
  selectedId: string | null;
  onSelect: (garage: Garage) => void;
};
```

- One `Marker` per garage whose coordinates are valid; skip the others (they stay in the list).
- Marker `title={g.title}`, `description={`${formatMoney(g.price_hour)}/h`}` using `formatMoney` from `src/utils/booking.ts`. Prices are in the app's currency helper, not hard-coded €.
- Initial region: `center` when present; otherwise fit all valid markers; otherwise the Lagera center from `AREAS` (seeded demo is Sofia-only).
- Selected marker uses `colors.accent` from `src/constants/theme.ts`; others neutral.
- Fixed height (about 320) inside the scrolling `ScreenWrapper`, with rounded corners matching `Card`. It must not cover the search box or the Find button.

Find screen changes (`src/app/(tabs)/index.tsx`):
- Add a **List / Map** toggle under the section title using the existing `ChipRow` from `src/components/Chip.tsx` (`options`, `value`, `onChange`). Default **List**.
- Map mode passes `shown.map((s) => s.garage)` (matches when a search is active, all garages otherwise), so list and map always show the same set. The "Other garages" section stays list-only.
- Below the map, render the selected garage with the existing `GarageRow` (distance included). Tapping it calls the existing `open(g)`, which carries `from`/`to` into the booking screen.
- When the search result changes, clear the selection if that garage is no longer in `shown`.

## 4. Boundaries

- The map is for finding garages and getting directions only. It must not call the door/ESP32 endpoints, decide whether a booking is active, or open a door. `server/server.js` stays the authority for bookings and door commands.
- A marker tap never books. Booking only happens through the confirmation on `garage/[id].tsx`.
- Natural-language parsing stays on the server (`/api/garages/search`). The map does not interpret text or invent coordinates for an area that has none.
- No new tab, no photo upload, no hardware work.

## 5. Acceptance checklist

Already met:
- [x] Demo garages have valid coordinates.
- [x] Nearby list works without the database (in-memory seed).
- [x] Distance sorting uses `distanceKm()`.
- [x] Missing coordinates and denied location keep the list usable.

Required:
- [ ] Row action and detail button open Google Maps **directions** to the garage.
- [ ] Garages without coordinates fall back to an address destination.
- [ ] A failed `openURL` shows an error toast.
- [ ] Booking and door-opening flows unchanged.

Optional (only if it works in Expo Go):
- [ ] Map renders on iOS and Android in Expo Go; web shows no toggle and no errors.
- [ ] One marker per garage with valid coordinates; list and map show the same garages.
- [ ] Tapping a marker selects it and shows its `GarageRow`; tapping that opens the detail screen with the searched time window.
- [ ] Denied location still gives a sensible initial region.

## 6. Before you finish

Run and report the results:

```bash
npx tsc --noEmit
npx expo lint
```

The lint run currently has pre-existing errors in files unrelated to maps (login, register, profile, host, Toast, useAsync). Do not fix those as part of this task; just make sure you add no new ones. Test directions on a phone (Expo Go) and on web.
