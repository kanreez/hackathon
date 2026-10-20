export const colors = {
    primary: "#2563eb",
    primaryDark: "#1d4ed8",
    secondary: "#e5e7eb",
    background: "#ffffff",
    surface: "#f9fafb",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#d1d5db",
    error: "#dc2626",
    success: "#16a34a",
    white: "#ffffff",
  } as const;
  
  export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  } as const;
  
  export const radius = {
    sm: 6,
    md: 10,
    lg: 16,
  } as const;
  
  export const typography = {
    h1: { fontSize: 32, fontWeight: "700" as const },
    h2: { fontSize: 24, fontWeight: "700" as const },
    h3: { fontSize: 20, fontWeight: "600" as const },
    body: { fontSize: 16, fontWeight: "400" as const },
    label: { fontSize: 14, fontWeight: "600" as const },
    caption: { fontSize: 12, fontWeight: "400" as const },
  } as const;