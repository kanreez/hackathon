import { Pressable, StyleSheet, Text, View } from "react-native";
import { placeLabel, SIZE_META } from "../constants/garages";
import { colors, spacing, typography } from "../constants/theme";
import { t, useT } from "../i18n";
import { Garage } from "../types/garage";
import { formatMoney } from "../utils/booking";
import { openDirections } from "../utils/maps";
import { RowAction } from "./Bits";
import { RatingLine } from "./Stars";

type Props = {
  garage: Garage;
  distanceKm?: number | null;
  onPress?: () => void;
};

export function formatKm(km: number) {
  return km < 1 ? t("units.m", { n: Math.round(km * 1000) }) : t("units.km", { n: km.toFixed(1) });
}

// One garage in a list: a flat row between hairlines. Garages that open from the phone get a
// painted bay line on the left edge, so it's visible at a glance; manual garages get nothing.
// The tappable info area and the directions button sit side by side, not one inside the
// other: on web each becomes a <button>, and a button can't contain another button.
export function GarageRow({ garage: g, distanceKm, onPress }: Props) {
  useT(); // re-render in a new language
  const app = g.access === "app";
  const where = distanceKm != null ? `${placeLabel(g)}, ${formatKm(distanceKm)}` : placeLabel(g);
  const spec = `${SIZE_META[g.size].label}, ${(g.covered ? t("garage.covered") : t("garage.openAir")).toLowerCase()}`;
  const info = (
    <>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {g.title}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {where}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {spec}
        </Text>
        <RatingLine rating={g.rating} />
        {app ? <Text style={styles.app}>{t("garage.opensFromPhone")}</Text> : null}
      </View>
      <View style={styles.prices}>
        <Text style={styles.price}>{formatMoney(g.price_hour)}</Text>
        <Text style={styles.caption}>{t("garage.perHour")}</Text>
        <Text style={[styles.caption, styles.tabular]}>{t("garage.aDay", { price: formatMoney(g.price_day) })}</Text>
      </View>
    </>
  );
  return (
    <View style={styles.row}>
      {app ? <View style={styles.bayLine} /> : null}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${g.title}, ${formatMoney(g.price_hour)} ${t("garage.perHour")}${app ? `, ${t("garage.opensFromPhone")}` : ""}`}
          onPress={onPress}
          style={({ pressed }) => [styles.info, pressed && { opacity: 0.75 }]}
        >
          {info}
        </Pressable>
      ) : (
        <View style={styles.info}>{info}</View>
      )}
      <RowAction icon="navigate" label={t("garage.directionsTo", { title: g.title })} onPress={() => openDirections(g)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingLeft: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // The painted bay line: only on garages that open from the phone
  bayLine: { position: "absolute", left: 0, top: 14, bottom: 14, width: 2, borderRadius: 1, backgroundColor: colors.cta },
  info: { flex: 1, flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  body: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  app: { ...typography.caption, color: colors.cta, marginTop: 2 },
  prices: { alignItems: "flex-end" },
  price: { ...typography.figureSm, color: colors.ink },
  tabular: typography.tabular,
});
