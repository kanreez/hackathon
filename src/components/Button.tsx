import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size?: "md" | "sm";
};

const palette: Record<Variant, { bg: string; fg: string; pressed: string }> = {
  primary: { bg: colors.ink, fg: colors.white, pressed: colors.inkSoft },
  secondary: { bg: colors.secondary, fg: colors.ink, pressed: colors.border },
  ghost: { bg: "transparent", fg: colors.ink, pressed: colors.secondary },
  danger: { bg: colors.errorSoft, fg: colors.error, pressed: "#F6D3D3" },
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
  const p = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        size === "sm" && styles.sm,
        { backgroundColor: state.pressed ? p.pressed : p.bg },
        isDisabled && styles.disabled,
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
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  sm: { minHeight: 38, paddingHorizontal: spacing.md },
  disabled: { opacity: 0.45 },
  text: { ...typography.label, fontSize: 16 },
  textSm: { fontSize: 14 },
});
