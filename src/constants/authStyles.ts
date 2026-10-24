import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./theme";

// Shared by login and register
export const authStyles = StyleSheet.create({
  page: { justifyContent: "center", maxWidth: 480, width: "100%", alignSelf: "center" },
  intro: { gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.ink },
  subtitle: { ...typography.body, color: colors.textMuted },
  form: { gap: spacing.md },
  submit: { marginTop: spacing.sm },
  footer: { ...typography.body, color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" },
  link: { fontFamily: typography.label.fontFamily, color: colors.accentDeep, textDecorationLine: "underline" },
});
