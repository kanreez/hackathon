import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "../constants/theme";

type Props = ViewProps & {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Concrete surface, flat. Pass onPress to make it tappable.
export function Card({ style, children, onPress, ...rest }: Props) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
});
