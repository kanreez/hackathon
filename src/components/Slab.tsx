import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../constants/theme";

// The tilted hot-orange shape behind the screen's hero card. Place it inside a
// relatively positioned wrapper, before the card; it overflows the screen edges on purpose.
export function Slab({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View pointerEvents="none" style={[styles.slab, style]} />;
}

const styles = StyleSheet.create({
  slab: {
    position: "absolute",
    top: 18,
    bottom: 18,
    left: -36,
    right: -36,
    borderRadius: 44,
    backgroundColor: colors.accent,
    transform: [{ rotate: "-5deg" }],
  },
});
