import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, shadow } from "../../constants/theme";
import { useRole } from "../../context/RoleContext";

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
  const { role } = useRole();
  // Residents report problems; the домоуправител gets the inbox and the building context form
  const isManager = role === "manager";
  return (
    <Tabs
      screenOptions={{
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
      <Tabs.Screen
        name="index"
        options={{ href: isManager ? null : undefined, title: "Report", tabBarIcon: ({ focused }) => <TabIcon name="camera" focused={focused} /> }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          href: isManager ? undefined : null,
          title: "Inbox",
          tabBarIcon: ({ focused }) => <TabIcon name="file-tray-full" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="building"
        options={{
          href: isManager ? undefined : null,
          title: "Building",
          tabBarIcon: ({ focused }) => <TabIcon name="business" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{ href: null, title: "Explore", tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ai"
        options={{ href: null, title: "Assistant", tabBarIcon: ({ focused }) => <TabIcon name="sparkles" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }}
      />
    </Tabs>
  );
}
