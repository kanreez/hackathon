# DESIGN.md: "Garage at night" for GarageGo

Read this before changing any screen, component or style. AGENTS.md still applies.
Tokens live in `src/constants/theme.ts`: never hardcode a hex in a screen; add a token there first.

## The idea
The look comes from the subject, not from app templates: asphalt and bare concrete, painted bay
lines, the blue parking sign (white P on blue), roller garage doors, parking tickets, Bulgarian number
plates. These are quiet motifs that carry information, never decoration.

One bold thing per product: **the roller door** on the active booking. Everything else stays calm so
the moment the real door moves on stage is the one people remember.

## Colour (token names kept from earlier themes)
| Token | Value | Role | Contrast |
|---|---|---|---|
| `background` | `#15171A` asphalt | app ground | ink 15.7:1, muted 7.0:1 |
| `surface` | `#22262B` concrete | rows, sheets, tickets, tab bar | ink 13.3:1, muted 6.0:1 |
| `sand` | `#2D3238` raised | inputs, quiet buttons, door slats | ink 11.3:1, muted 5.1:1 |
| `border` | `#3A4048` | hairlines, door frame | decorative |
| `ink` / `textMuted` | `#EEF0F2` / `#9BA3AD` | text | |
| `accent` | `#1F5FD0` sign blue | brand tile, selection, active tab, map pins | white on it 5.8:1 |
| `accentDeep` | `#7FA8FF` | sign blue as text on dark | 7.7:1 |
| `accentSoft` | `#162238` | selected tiles | ink 13.9:1 |
| `cta` | `#F5C400` line yellow | **the one action colour**: Open, the forward button, bay lines | `onCta` 10.9:1 |
| `onAccent` / `onCta` / `onInk` | `#FFFFFF` / `#15171A` / `#15171A` | text on blue / yellow / light fills | |
| `success` / `errorText` | `#4CC38A` / `#FF8A85` | status only | 7–8:1 |
| `error` | `#C8261C` | error fill, white text | 5.6:1 |
| `plate` | `#F2F4F7` | number-plate strips | `onInk` 16.3:1 |

Blue and yellow take opposite text colours, which is why `onCta` exists next to `onAccent`.
Shadows: `card` is empty on purpose. Hierarchy comes from the three surface steps and spacing. Only
floating things (tab bar, toasts) get `float`; only the yellow Open control gets the soft `glow`.

## Type: Overpass (from highway signage)
Verified in the font files: full Bulgarian Cyrillic and tabular figures in every weight.
Barlow and Barlow Condensed were rejected: no Cyrillic.

| Style | Size / line | Weight |
|---|---|---|
| `display` | 34/38 | 800 |
| `h1` | 26/30 | 800 |
| `h2` | 19/24 | 700 |
| `h3` | 16/21 | 600 |
| `body` / `subline` | 15/22 · 16/23 | 400 |
| `label` | 14/18 | 600 |
| `caption` | 13/17 | 400 |
| `figure` / `figureSm` | 40/44 · 22/26 | 800 / 700, tabular |

Numbers are the content (prices, times, durations, countdowns): set them with `figure`/`figureSm`
or `typography.tabular` so they don't jitter. Sentence case everywhere; no all-caps; no single word
of a headline styled differently.

## The roller door (`src/components/DoorPanel.tsx`)
Seven slats in a frame over a dark bay, the garage title and time left above, a 64pt button below.
The state is derived from the existing door command status in `bookings.tsx`; door logic is not here.

| State | Door | Caption | Button |
|---|---|---|---|
| closed | down | "Stand by the door, then tap Open." / "Closed 02:37" | yellow **Open** |
| opening (queued) | lifts 6px and holds, slats shimmer | "Talking to the door…" | loading |
| open | rolls up into the frame (700 ms, ease-out); the bay floor line lights | "Opened 02:37" (real `acked_at`) | light **Close** |
| closing | holds 6px below open, shimmer | "Talking to the door…" | loading |
| error | drops back to where it was, short shake | the server's message, red | **Try again** |

Reduced motion (`AccessibilityInfo.isReduceMotionEnabled`): crossfade between states, no movement.
The caption is a live region; the error caption is an alert. Phones get a success or error haptic.
Yellow always means "open the door": closing is the quiet light button.

## Supporting motifs
- **Bay line:** a 2px line-yellow bar on the left edge of garages that open from the phone (list rows,
  and the access line on Book). Manual garages get nothing.
- **Parking ticket:** upcoming and past bookings show In and Out as large times, a perforated tear
  line, then garage, status, payment and amount.
- **Number plate:** each filter the AI understood is a white strip with a slim blue band on the left.
- **Logo:** a white P on sign blue.

## Rules
- One line-yellow action per screen. Secondary actions are quiet (`secondary`, `ghost`).
- Touch targets ≥ 44pt. Text contrast ≥ 4.5:1 (3:1 only for large text and icons).
- Lists are flat rows separated by hairlines, not a card per item. Cards are for things that are one
  object (a ticket, the active booking, a sheet).
- Press feedback: `scale(0.96)` on buttons only; rows dim to 0.75 opacity instead.
- No eyebrow labels that repeat the heading, no middle-dot meta strings, no AI sparkle icons, no
  gradients, no glow or tilted shapes as decoration, no fade-in on every section.
- Every async action shows its state where the user is looking. Errors say what happened and what to
  do; they never apologise. Empty states invite the next action.
- Same verb through a flow: Open → Opening… → Opened; Book → Booked; Pay → Paid.
- Plain words from the renter's side ("Opens from your phone"). English UI; the Bulgarian example
  query stays as it is.
- Check the wide (web/PC) layout after the phone layout.

## Checks before "done"
1. `npx tsc --noEmit` and `npx expo lint` (the existing errors in `profile.tsx`, `host/index.tsx`,
   `StateViews.tsx`, `Toast.tsx`, `useAsync.ts`, `_layout.tsx` are known).
2. Phone (390×844) and desktop width: nothing hidden behind the floating tab bar, tab labels visible.
3. Door states with the fake device: `node server/fake-device.js`, and the error mode
   (PowerShell `$env:FAIL=1; node server/fake-device.js`, cmd `set FAIL=1&& node server/fake-device.js`).
