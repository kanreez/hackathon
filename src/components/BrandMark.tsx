import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "../constants/app";
import { colors, fonts, typography } from "../constants/theme";
import { LogoTile } from "./Bits";

// App logo + name. Swap the icon for a real logo on the day.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <LogoTile size={size} />
      <Text style={styles.name}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { ...typography.h3, fontFamily: fonts.bold, color: colors.ink },
});
