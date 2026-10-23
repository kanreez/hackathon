import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";
import { Item } from "../constants/mockData";

type Props = {
  item: Item;
  onPress?: () => void;
  distanceKm?: number; // shown when the list is sorted by distance
};

// Flat list row: thumbnail, title, short description, meta line
export function ItemRow({ item, onPress, distanceKm }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" transition={150} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
          </View>
          {distanceKm !== undefined ? <Text style={styles.metaText}>{formatKm(distanceKm)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function formatPrice(price: number) {
  return price === 0 ? "Free" : `€${price % 1 === 0 ? price : price.toFixed(2)}`;
}

export function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.secondary },
  body: { flex: 1, justifyContent: "center", gap: 3 },
  title: { ...typography.h3, color: colors.ink },
  desc: { ...typography.caption, color: colors.textMuted },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 2 },
  price: { ...typography.label, color: colors.ink },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { ...typography.caption, color: colors.textMuted },
});
