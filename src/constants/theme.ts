// Design tokens: "Ignite" dark theme (see DESIGN.md). Re-skin the whole app by editing this file.
// Dark grainy ground, hot orange for shapes and brand, amber for the main button.
// Every text/background pair below passes WCAG AA (4.5:1).

export const colors = {
  background: "#161514", // app ground
  surface: "#22201E", // cards, rows, tab bar, icon buttons
  sand: "#2C2926", // inputs, quiet buttons, empty thumbs (name kept for old code)
  border: "#34302C", // hairlines, input borders, tracker lines
  ink: "#F7F4F0", // main text; also the fill of "primary" (light) buttons
  inkSoft: "#E4DED7", // pressed primary
  onInk: "#161514", // text/icons on an ink (light) fill
  textMuted: "#A39C95", // hints, captions
  accent: "#FF5A1F", // hot orange: slabs, logo tile, active tab, step badges
  accentSoft: "#3A2216", // dark orange tint (chips, selected tiles, context cards)
  accentDeep: "#FF6A2B", // orange TEXT on the dark ground (sublines, links, eyebrows)
  cta: "#FF8A1F", // amber: the one forward button per screen
  ctaPressed: "#F07A10",
  onAccent: "#161514", // text/icons on accent, cta and route solids
  success: "#5BCB8A",
  successSoft: "#17291F",
  error: "#D92D20", // emergency fill, white text on it
  errorSoft: "#3A1714",
  errorText: "#FF8A80", // red text on the dark ground
  white: "#FFFFFF", // true white: logo glyph, text on error fill

  // Aliases kept so older code keeps working
  primary: "#F7F4F0",
  primaryDark: "#E4DED7",
  secondary: "#2C2926",
  text: "#F7F4F0",
} as const;

// One pair per category. solid = icon tiles, tags, accents; tint = card background.
// Text on solid uses colors.onAccent; text on tint uses colors.ink or the solid.
export const routeColors = {
  diy: { solid: "#7BCB5C", tint: "#1E2A1A" },
  specialist: { solid: "#F2B441", tint: "#2E2414" },
  manager: { solid: "#C99AE6", tint: "#2A1F30" },
  neighbor: { solid: "#56C7BA", tint: "#14292A" },
} as const;

// Shadows read as depth on dark only when they are strong. RN boxShadow works on iOS, Android, web.
export const shadow = {
  card: { boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.35)" },
  float: { boxShadow: "0px 18px 40px rgba(0, 0, 0, 0.55)" },
  glow: { boxShadow: "0px 12px 28px rgba(255, 138, 31, 0.35)" }, // amber CTA only
} as const;

// Loaded in src/app/_layout.tsx. Change the family there and here together.
// Montserrat covers Cyrillic, so Bulgarian text keeps the same font.
export const fonts = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semibold: "Montserrat_600SemiBold",
  bold: "Montserrat_800ExtraBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Radius follows hierarchy: hero blocks are rounder than small controls.
export const radius = { sm: 12, md: 16, lg: 22, xl: 34, pill: 999 } as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  subline: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 }, // orange line under headlines
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
} as const;
