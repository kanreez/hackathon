import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";

// Small shared pieces of the Ignite system (DESIGN.md)

type IconName = ComponentProps<typeof Ionicons>["name"];

type IconTileProps = {
  icon: IconName;
  size?: number; // 40–56
  bg?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

// Orange and amber fills always take dark icons
const ON_ORANGE: string[] = [colors.accent, colors.cta];

// Rounded-square tile holding an icon
export function IconTile({ icon, size = 44, bg = colors.sand, color, style }: IconTileProps) {
  const fg = color ?? (ON_ORANGE.includes(bg) ? colors.onAccent : colors.ink);
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.34), backgroundColor: bg },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={fg} />
    </View>
  );
}

// 44px round sand button at the right end of a tappable row
export function RowAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  if (!onPress) {
    return (
      <View style={styles.rowAction} accessibilityElementsHidden importantForAccessibility="no">
        <Ionicons name={icon} size={20} color={colors.ink} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.rowAction, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

// 28px orange badges with dark numbers
export function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

// Red "do this now" block. Only for urgent / emergency.
export function UrgentBanner({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.urgent, style]} accessibilityRole="alert">
      <View style={styles.urgentTile}>
        <Ionicons name="warning" size={22} color={colors.error} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.urgentEyebrow}>Do this first</Text>
        <Text style={styles.urgentText}>{text}</Text>
      </View>
    </View>
  );
}

// Small pill: tinted fill or outlined in a colour
export function Tag({
  label,
  color = colors.ink,
  bg,
  outline,
  icon,
}: {
  label: string;
  color?: string;
  bg?: string;
  outline?: boolean;
  icon?: IconName;
}) {
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: bg ?? "transparent" },
        outline && { borderWidth: 1.5, borderColor: color },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

// Screen intro: big bold white headline with a short orange subline under it
export function Headline({ title, subline, style }: { title: string; subline?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.headline, style]}>
      <Text style={styles.display} accessibilityRole="header">
        {title}
      </Text>
      {subline ? <Text style={styles.subline}>{subline}</Text> : null}
    </View>
  );
}

// The orange logo tile: 40px in headers, 64px on the auth screens
export function LogoTile({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: colors.accent }]}>
      <Ionicons name="car" size={Math.round(size * 0.5)} color={colors.white} />
    </View>
  );
}

// Section title used between cards
export function SectionTitle({ children, muted }: { children: string; muted?: boolean }) {
  return <Text style={[styles.section, muted && { color: colors.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
  rowAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { gap: spacing.md },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { ...typography.label, fontSize: 13, color: colors.onAccent },
  stepText: { ...typography.body, color: colors.ink, flex: 1, marginTop: 2 },
  urgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadow.float,
  },
  urgentTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentEyebrow: { ...typography.eyebrow, color: colors.white, opacity: 0.85 },
  urgentText: { ...typography.h3, color: colors.white },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tagText: { ...typography.label, fontSize: 12, lineHeight: 15, flexShrink: 1 },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.md },
  headline: { gap: spacing.sm },
  display: { ...typography.display, color: colors.ink },
  subline: { ...typography.subline, color: colors.accentDeep },
});
