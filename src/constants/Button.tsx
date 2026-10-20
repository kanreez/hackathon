import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
};

export function Button({ title, variant = "primary", loading = false, disabled, style, ...rest }: Props) {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.text} />
      ) : (
        <Text style={[styles.text, { color: isPrimary ? colors.white : colors.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { ...typography.label, fontSize: 16 },
});