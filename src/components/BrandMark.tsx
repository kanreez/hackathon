import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "../constants/app";
import { colors, radius, typography } from "../constants/theme";

// App logo + name. Swap the icon for a real logo on the day.
export function BrandMark() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Ionicons name="rocket" size={20} color={colors.ink} />
      </View>
      <Text style={styles.name}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...typography.h3, color: colors.ink },
});
