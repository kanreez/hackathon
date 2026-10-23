// Design tokens. Re-skin the whole app for the hackathon theme by editing this file.
// Direction: cool fog background, navy "ink" for text and primary actions,
// one marigold accent reserved for the single most important thing on a screen.

export const colors = {
  background: "#EEF1F5", // fog: app background
  surface: "#FFFFFF", // rows, inputs, sheets
  ink: "#17213A", // text + primary buttons
  inkSoft: "#2A3655", // pressed primary
  textMuted: "#5D667A",
  border: "#D8DEE8",
  accent: "#FFB627", // marigold: hero block, active tab, highlights
  accentSoft: "#FFF1CF",
  success: "#1E9E6A",
  error: "#D64545",
  errorSoft: "#FBE7E7",
  white: "#FFFFFF",

  // Aliases kept so older code keeps working
  primary: "#17213A",
  primaryDark: "#2A3655",
  secondary: "#E2E7EF",
  text: "#17213A",
} as const;

// Loaded in src/app/_layout.tsx. Change the family there and here together.
export const fonts = {
  regular: "BricolageGrotesque_400Regular",
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_800ExtraBold",
} as const;

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
  sm: 8,
  md: 14, // inputs
  lg: 18, // images, rows
  xl: 28, // hero / feature blocks
  pill: 999, // buttons, chips
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
} as const;
