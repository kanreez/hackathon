import { Platform } from "react-native";

// Design tokens for the "Ember" system (see DESIGN.md). Never hardcode a hex in a screen.
// Direction: warm cream ground, espresso ink for text and primary actions,
// one tangerine accent reserved for the single most important thing on a screen.

export const colors = {
  background: "#FBF4EA", // cream: app background
  surface: "#FFFDF9", // cards, rows, inputs, tab bar
  sand: "#F3E8DA", // secondary buttons, quiet fills, empty thumbnails
  border: "#EDE1D3", // input borders, dividers, tracker lines
  ink: "#20160F", // text + primary buttons + selected states
  inkSoft: "#3A2A1F", // pressed primary
  textMuted: "#6B5B4E",
  accent: "#FF6B2C", // tangerine hero colour: only ink text/icons on it
  accentSoft: "#FFE3D1",
  accentDeep: "#B23A0B", // tangerine for text/icons on cream
  success: "#276B3E",
  successSoft: "#E3F0DF",
  error: "#B42318", // emergency / immediate action only
  errorSoft: "#FDE4E1",
  white: "#FFFDF9", // "white" text on dark fills (warm, not #FFF)

  // Aliases kept so older code keeps working
  primary: "#20160F",
  primaryDark: "#3A2A1F",
  secondary: "#F3E8DA",
  text: "#20160F",
} as const;

// Route colours: solid for icon tiles and outlined tags, tint for card backgrounds with ink text
export const routeColors = {
  diy: { solid: "#35692A", tint: "#E6F1D9" },
  specialist: { solid: "#8A5200", tint: "#FCEBC8" },
  manager: { solid: "#7A3A8C", tint: "#F2E3F5" },
  neighbor: { solid: "#1F6F6A", tint: "#DCEFEC" },
} as const;

// RN boxShadow strings: spread into styles, never add elevation
export const shadow = {
  card: { boxShadow: "0px 2px 10px rgba(74, 44, 20, 0.07)" },
  float: { boxShadow: "0px 10px 30px rgba(74, 44, 20, 0.16)" },
  glow: { boxShadow: "0px 10px 26px rgba(255, 107, 44, 0.35)" },
} as const;

// Bricolage Grotesque has no Cyrillic. Phones fall back to the system sans per glyph;
// on web the CSS stack does the same, instead of the browser's default serif.
const withFallback = (name: string) =>
  Platform.OS === "web" ? `${name}, system-ui, "Segoe UI", Roboto, Arial, sans-serif` : name;

// Loaded in src/app/_layout.tsx. Change the family there and here together.
export const fonts = {
  regular: withFallback("BricolageGrotesque_400Regular"),
  medium: withFallback("BricolageGrotesque_500Medium"),
  semibold: withFallback("BricolageGrotesque_600SemiBold"),
  bold: withFallback("BricolageGrotesque_800ExtraBold"),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Radius follows hierarchy: big feature blocks are rounder than small controls.
export const radius = {
  sm: 10,
  md: 16, // inputs, small tiles
  lg: 22, // cards, rows
  xl: 32, // hero blocks
  pill: 999, // buttons, chips, tags
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 38, lineHeight: 40, letterSpacing: -1 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, letterSpacing: 1.2, textTransform: "uppercase" },
} as const;
