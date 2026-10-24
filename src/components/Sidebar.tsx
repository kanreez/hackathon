import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";
import { BrandMark } from "./BrandMark";
import { Button } from "./Button";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Same icons as the phone tab bar in src/app/(tabs)/_layout.tsx
const ICONS: Record<string, string> = { index: "search", bookings: "key", profile: "person" };

// PC layout: replaces the floating bottom tab bar with a left-hand sidebar
export function Sidebar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <BrandMark />
      </View>

      <View style={styles.nav} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { title } = descriptors[route.key].options;
          const icon = ICONS[route.name] ?? "ellipse";
          // Same as the default tab bar: let screens intercept the press, then switch tab
          const onPress = () => {
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
              onPress={onPress}
              style={(s) => [
                styles.item,
                focused ? styles.itemOn : (s as { hovered?: boolean }).hovered && styles.itemHover,
              ]}
            >
              <Ionicons
                name={(focused ? icon : `${icon}-outline`) as IconName}
                size={20}
                color={focused ? colors.ink : colors.textMuted}
              />
              <Text style={[styles.label, focused && { color: colors.ink }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.host}>
        <Text style={styles.hostTitle}>Have a garage?</Text>
        <Text style={styles.hostBody}>{"Rent it out while you don't need it. You set the price and the hours."}</Text>
        <Button title="List your garage" icon="add" size="sm" variant="secondary" onPress={() => router.push("/host")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 248,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  brand: { paddingHorizontal: spacing.sm, marginBottom: spacing.xl },
  nav: { gap: 4, flex: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  itemOn: { backgroundColor: colors.accent },
  itemHover: { backgroundColor: colors.sand },
  label: { ...typography.label, fontSize: 15, color: colors.textMuted },
  host: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background },
  hostTitle: { ...typography.h3, color: colors.ink },
  hostBody: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
