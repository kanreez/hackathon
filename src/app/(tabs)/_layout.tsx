import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Active tab gets a marigold pill behind a filled icon
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 54,
        height: 30,
        borderRadius: 15,
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          // Taller than default so the icon pill and label both fit
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, marginTop: 2 },
        tabBarIconStyle: { height: 30 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ai"
        options={{ title: "Assistant", tabBarIcon: ({ focused }) => <TabIcon name="sparkles" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }}
      />
    </Tabs>
  );
}
