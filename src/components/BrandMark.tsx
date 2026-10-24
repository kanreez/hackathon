import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "../constants/app";
import { colors, typography } from "../constants/theme";

// App logo + name. Swap the icon for a real logo on the day.
export function BrandMark() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Ionicons name="car" size={20} color={colors.ink} />
      </View>
      <Text style={styles.name}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...typography.h3, color: colors.ink },
});
