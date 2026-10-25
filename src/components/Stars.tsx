import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../constants/theme";
import { useT } from "../i18n";
import { RatingSummary } from "../types/garage";

// Stars are ink, not yellow: line yellow stays reserved for opening the door and the forward action

type StarsProps = { value: number; size?: number; color?: string };

// Read-only: rounds to the nearest half star
export function Stars({ value, size = 14, color = colors.ink }: StarsProps) {
  const { t } = useT();
  const halves = Math.round(value * 2);
  return (
    <View style={styles.row} accessibilityLabel={t("stars.label", { n: value })} accessible>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={halves >= i * 2 ? "star" : halves === i * 2 - 1 ? "star-half" : "star-outline"}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

// Average + count, e.g. "★ 4.5  2 reviews"; nothing when a garage has no reviews yet
export function RatingLine({ rating, emptyText }: { rating?: RatingSummary; emptyText?: string }) {
  const { tn } = useT();
  if (!rating || !rating.count || rating.average == null) {
    return emptyText ? <Text style={styles.muted}>{emptyText}</Text> : null;
  }
  return (
    <View style={styles.line}>
      <Ionicons name="star" size={12} color={colors.ink} />
      <Text style={styles.average}>{rating.average.toFixed(1)}</Text>
      <Text style={styles.muted}>
        {tn("reviews.count", rating.count)}
      </Text>
    </View>
  );
}

// Tap a star to rate. Each star is a 44pt target.
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t, tn } = useT();
  return (
    <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel={t("stars.rating")}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === i }}
          accessibilityLabel={tn("stars.n", i)}
          onPress={() => onChange(i)}
          style={({ pressed }) => [styles.pick, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Ionicons name={value >= i ? "star" : "star-outline"} size={30} color={value >= i ? colors.ink : colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  average: { ...typography.label, color: colors.ink, ...typography.tabular },
  muted: { ...typography.caption, color: colors.textMuted },
  picker: { flexDirection: "row", gap: 4 },
  pick: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
