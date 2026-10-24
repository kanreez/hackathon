import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sidebar } from "../../components/Sidebar";
import { colors, fonts, shadow } from "../../constants/theme";
import { useIsWide } from "../../hooks/useIsWide";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Active tab gets a tangerine pill behind a filled icon
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
        color={focused ? colors.ink : colors.textMuted}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
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
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          borderRadius: 36,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          ...shadow.float,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, marginTop: 2 },
        tabBarIconStyle: { height: 32 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Find", tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: ({ focused }) => <TabIcon name="key" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
