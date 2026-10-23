import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../constants/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  // Pull-to-refresh (only with scroll)
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function ScreenWrapper({
  children,
  scroll = false,
  padded = true,
  style,
  edges = ["top", "left", "right"],
  refreshing,
  onRefresh,
}: Props) {
  const padding = padded ? styles.padded : null;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, padding, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padding, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
