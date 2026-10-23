import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean; // show a back arrow
  right?: ReactNode; // e.g. an icon button or avatar
};

export function Header({ title, subtitle, back, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {back ? <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} /> : null}
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

type IconButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; // for screen readers
  onPress: () => void;
  tone?: "plain" | "solid";
};

export function IconButton({ icon, label, onPress, tone = "plain" }: IconButtonProps) {
  const solid = tone === "solid";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: solid ? colors.ink : colors.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={20} color={solid ? colors.white : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.h1, color: colors.ink },
  subtitle: { ...typography.body, color: colors.textMuted },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
