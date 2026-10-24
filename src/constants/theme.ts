// Design tokens: "Garage at night" (see DESIGN.md). Re-skin the whole app by editing this file.
// Asphalt and concrete for the ground, sign blue for brand and selection, line yellow (the
// painted bay line) as the one action colour. Every text/background pair passes WCAG AA.

export const colors = {
  background: "#15171A", // asphalt: app ground
  surface: "#22262B", // concrete: rows, sheets, tab bar
  sand: "#2D3238", // raised: inputs, quiet buttons, empty thumbs (name kept for old code)
  border: "#3A4048", // hairlines, input borders, door frame
  ink: "#EEF0F2", // main text (15.7:1 on asphalt); also the fill of "primary" (light) buttons
  inkSoft: "#D5D9DE", // pressed primary
  onInk: "#15171A", // text/icons on an ink (light) fill
  textMuted: "#9BA3AD", // hints, captions (7.0:1 on asphalt, 5.1:1 on raised)
  accent: "#1F5FD0", // sign blue: brand tile, selection, active tab, map pins
  accentSoft: "#162238", // dark blue tint: selected tiles, info strips
  accentDeep: "#7FA8FF", // sign blue as TEXT on the dark ground (7.7:1)
  onAccent: "#FFFFFF", // text/icons on sign blue (5.8:1)
  cta: "#F5C400", // line yellow: Open, and the one forward button per screen
  ctaPressed: "#E0B400",
  onCta: "#15171A", // text/icons on line yellow (10.9:1)
  success: "#4CC38A",
  successSoft: "#14271F",
  error: "#C8261C", // emergency fill, white text on it (5.6:1)
  errorSoft: "#3A1C1C",
  errorText: "#FF8A85", // red text on the dark ground
  white: "#FFFFFF", // logo glyph, text on the error fill
  plate: "#F2F4F7", // number-plate white for the "What I understood" strips

  // Aliases kept so older code keeps working
  primary: "#EEF0F2",
  primaryDark: "#D5D9DE",
  secondary: "#2D3238",
  text: "#EEF0F2",
} as const;

// Left over from an earlier idea; kept so nothing that imports it breaks
export const routeColors = {
  diy: { solid: "#4CC38A", tint: "#14271F" },
  specialist: { solid: "#F5C400", tint: "#2E2814" },
  manager: { solid: "#7FA8FF", tint: "#162238" },
  neighbor: { solid: "#56C7BA", tint: "#14292A" },
} as const;

// Flat by default: hierarchy comes from surface steps and spacing. Only floating things get depth.
export const shadow = {
  card: {},
  float: { boxShadow: "0px 12px 32px rgba(0, 0, 0, 0.5)" },
  glow: { boxShadow: "0px 10px 28px rgba(245, 196, 0, 0.22)" }, // the Open control only
} as const;

// Loaded in src/app/_layout.tsx. Change the family there and here together.
// Overpass is drawn from highway signage and covers Cyrillic, so Bulgarian text keeps the same face.
export const fonts = {
  regular: "Overpass_400Regular",
  medium: "Overpass_500Medium",
  semibold: "Overpass_600SemiBold",
  bold: "Overpass_700Bold",
  heavy: "Overpass_800ExtraBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Radius follows hierarchy: hero blocks are rounder than small controls.
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

// Equal-width digits: prices, times and countdowns don't jitter while they change
const tabular = { fontVariant: ["tabular-nums"] as ("tabular-nums")[] };

export const typography = {
  display: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.heavy, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  subline: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 }, // muted line under headlines
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  figure: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -0.5, ...tabular }, // big numbers
  figureSm: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, ...tabular },
  tabular,
} as const;
