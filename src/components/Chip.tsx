import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
};

export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  const fg = selected ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.ink : colors.surface, borderColor: selected ? colors.ink : colors.border },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

type ChipRowProps<T extends string> = {
  options: readonly { value: T; label: string; icon?: ChipProps["icon"] }[];
  value: T;
  onChange: (value: T) => void;
};

// Horizontally scrolling single-select row of chips
export function ChipRow<T extends string>({ options, value, onChange }: ChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  text: { ...typography.label },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
});
