import { Linking, StyleSheet, Text, View } from "react-native";
import { SIZE_META } from "../constants/garages";
import { colors, spacing, typography } from "../constants/theme";
import { Garage } from "../types/garage";
import { formatMoney } from "../utils/booking";
import { IconTile, RowAction, Tag } from "./Bits";
import { Card } from "./Card";

type Props = {
  garage: Garage;
  distanceKm?: number | null;
  onPress?: () => void;
};

export const openInMaps = (g: Pick<Garage, "latitude" | "longitude" | "address" | "title">) =>
  Linking.openURL(
    g.latitude != null && g.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${g.latitude},${g.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${g.address ?? g.title}, Sofia`)}`
  );

export function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// One garage in a list: access tile, title, where, tags, price, and an "open in maps" action
export function GarageRow({ garage: g, distanceKm, onPress }: Props) {
  const app = g.access === "app";
  return (
    <Card style={styles.row} onPress={onPress} accessibilityLabel={`${g.title}, ${formatMoney(g.price_hour)} per hour`}>
      <IconTile
        icon={app ? "phone-portrait" : "key"}
        size={48}
        bg={app ? colors.accent : colors.sand}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {g.title}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {g.area}
          {distanceKm != null ? ` · ${formatKm(distanceKm)}` : ""}
        </Text>
        <View style={styles.tags}>
          <Tag label={SIZE_META[g.size].label} bg={colors.sand} />
          <Tag label={g.covered ? "Covered" : "Open-air"} bg={colors.sand} />
          {app ? <Tag label="App door" icon="flash" bg={colors.accentSoft} color={colors.accentDeep} /> : null}
        </View>
        <Text style={styles.price}>
          {formatMoney(g.price_hour)}/h · {formatMoney(g.price_day)}/day
        </Text>
      </View>
      <RowAction icon="navigate" label={`Open ${g.title} in maps`} onPress={() => openInMaps(g)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.sm, padding: 14 },
  body: { flex: 1, gap: 4 },
  title: { ...typography.h3, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  price: { ...typography.label, color: colors.ink, marginTop: 2 },
});
