import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sidebar } from "../../components/Sidebar";
import { colors, fonts, shadow } from "../../constants/theme";
import { useIsWide } from "../../hooks/useIsWide";
import { useT } from "../../i18n";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Active tab gets an orange pill behind a filled dark icon
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? colors.accent : "transparent",
      }}
    >
      <Ionicons
        name={(focused ? name : `${name}-outline`) as IconName}
        size={20}
        color={focused ? colors.onAccent : colors.textMuted}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const { t } = useT();
  return (
    <Tabs
      // PC: a sidebar on the left instead of the floating bar
      tabBar={wide ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        ...(wide ? { tabBarPosition: "left" as const } : null),
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        // Floating pill; ScreenWrapper pads scroll content so nothing hides behind it
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: insets.bottom + 12,
          marginHorizontal: 16,
          // 80 tall: each tab keeps 5px padding, so this leaves room for the 32px pill + the 16px label
          height: 80,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 40,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          ...shadow.float,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, marginTop: 2 },
        tabBarIconStyle: { height: 32 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.find"), tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ title: t("tabs.bookings"), tabBarIcon: ({ focused }) => <TabIcon name="key" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
