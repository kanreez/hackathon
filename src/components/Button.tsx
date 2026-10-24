import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";

// accent = the line-yellow step forward: one per screen
type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size?: "md" | "sm";
};

const palette: Record<Variant, { bg: string; fg: string; pressed: string }> = {
  primary: { bg: colors.ink, fg: colors.onInk, pressed: colors.inkSoft },
  accent: { bg: colors.cta, fg: colors.onCta, pressed: colors.ctaPressed },
  secondary: { bg: colors.sand, fg: colors.ink, pressed: colors.border },
  ghost: { bg: "transparent", fg: colors.ink, pressed: colors.sand },
  danger: { bg: colors.errorSoft, fg: colors.errorText, pressed: colors.errorSoft },
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  icon,
  size = "md",
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  // A disabled yellow button would turn muddy; it shows as a quiet raised one instead
  const p = variant === "accent" && disabled && !loading ? palette.secondary : palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        size === "sm" && styles.sm,
        { backgroundColor: state.pressed ? p.pressed : p.bg },
        variant === "accent" && !isDisabled && shadow.glow,
        state.pressed && styles.pressed,
        isDisabled && (variant === "accent" ? styles.disabledQuiet : styles.disabled),
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={p.fg} /> : null}
          <Text style={[styles.text, size === "sm" && styles.textSm, { color: p.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  sm: { minHeight: 44, paddingHorizontal: spacing.md },
  pressed: { transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.45 },
  disabledQuiet: { opacity: 0.7 },
  text: { ...typography.label, fontSize: 16 },
  textSm: { fontSize: 14 },
});
