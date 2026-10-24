import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType; key: number } | null;

let showRef: ((message: string, type?: ToastType) => void) | null = null;

/**
 * Show a short message at the top of the screen. Works on web and phones
 * (unlike Alert.alert, which does nothing on web). Callable from anywhere:
 *   notify("Saved")            notify(e.message, "error")
 */
export function notify(message: string, type: ToastType = "success") {
  if (showRef) showRef(message, type);
  else console.log(`[notify:${type}]`, message);
}

const icons: Record<ToastType, React.ComponentProps<typeof Ionicons>["name"]> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  useEffect(() => {
    showRef = show;
    return () => {
      showRef = null;
    };
  }, [show]);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
        setToast(null)
      );
    }, 2800);
    return () => clearTimeout(t);
  }, [toast, anim]);

  return (
    <>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            toast.type === "error" && { backgroundColor: colors.error, borderColor: colors.error },
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <Ionicons
            name={icons[toast.type]}
            size={20}
            color={toast.type === "success" ? colors.accent : toast.type === "error" ? colors.white : colors.ink}
          />
          <Text style={[styles.text, toast.type === "error" && { color: colors.white }]}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    alignSelf: "center",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1000,
    ...shadow.float,
  },
  text: { ...typography.label, color: colors.ink, flex: 1 },
});
