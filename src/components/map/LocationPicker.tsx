import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useIsWide } from "../../hooks/useIsWide";
import { useT } from "../../i18n";
import { Coords, getCurrentLocation } from "../../utils/location";
import { Button } from "../Button";
import { notify } from "../Toast";
import { AppMap } from "./AppMap";

// Where the parent wants the map to look. A new `id` moves the map there, even to the same spot.
export type MapFocus = { at: Coords; zoom: number; id: number };

type Props = {
  value: Coords | null;
  onChange: (coords: Coords | null) => void; // tap, drag end, or Remove pin
  fallbackCenter: Coords; // e.g. the chosen area's centre, while there's no pin yet
  zoom?: number; // used with fallbackCenter
  focus?: MapFocus | null; // when given, the map looks here instead
  pinLabel?: string | null; // "ул. Цар Самуил 110, Лагера", shown instead of the coordinates
  // With it, "Use my location" hands the spot to the parent (which places the pin and moves
  // the map); without it the picker does both itself
  onLocate?: (coords: Coords) => void;
};

// Host side: tap the map to drop the garage's pin, drag it to fine-tune, or use the phone's GPS
export function LocationPicker({ value, onChange, fallbackCenter, zoom = 16, focus, pinLabel, onLocate }: Props) {
  const { t } = useT();
  const wide = useIsWide();
  // The map only moves on purpose (a new area or focus, "Use my location"), never after a tap or
  // drag, so it doesn't follow `value`. An existing garage opens on its own pin.
  const [initialPin] = useState(value);
  const [located, setLocated] = useState<{ at: Coords; area: Coords } | null>(null);
  const [locating, setLocating] = useState(false);
  const center = focus
    ? focus.at
    : located?.area === fallbackCenter ? located.at : initialPin && !located ? initialPin : fallbackCenter;

  const locate = async () => {
    try {
      setLocating(true);
      const here = await getCurrentLocation();
      if (onLocate) {
        onLocate(here);
      } else {
        setLocated({ at: here, area: fallbackCenter }); // until the host picks another area
        onChange(here);
      }
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <AppMap
          center={center}
          zoom={focus ? focus.zoom : zoom}
          recenterKey={focus?.id}
          picked={value}
          onPick={onChange}
          style={{ height: wide ? 320 : 260 }}
        />
        {!value ? (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>{t("map.tapHint")}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.row}>
        <Button title={t("map.useLocation")} icon="locate" size="sm" variant="secondary" loading={locating} onPress={locate} />
        {value ? <Button title={t("map.removePin")} size="sm" variant="ghost" onPress={() => onChange(null)} /> : null}
      </View>
      <Text style={styles.caption}>
        {!value
          ? t("map.pinHint")
          : pinLabel
            ? t("map.pinAtPlace", { place: pinLabel })
            : t("map.pinAt", { lat: value.latitude.toFixed(5), lng: value.longitude.toFixed(5) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: "absolute",
    top: spacing.sm,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  hintText: { ...typography.label, fontSize: 13, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  caption: { ...typography.caption, color: colors.textMuted },
});
