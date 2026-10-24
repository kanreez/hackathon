import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useIsWide } from "../../hooks/useIsWide";
import { Coords, getCurrentLocation } from "../../utils/location";
import { Button } from "../Button";
import { notify } from "../Toast";
import { AppMap } from "./AppMap";

type Props = {
  value: Coords | null;
  onChange: (coords: Coords | null) => void;
  fallbackCenter: Coords; // e.g. the chosen area's centre, while there's no pin yet
};

// Host side: tap the map to drop the garage's pin, drag it to fine-tune, or use the phone's GPS
export function LocationPicker({ value, onChange, fallbackCenter }: Props) {
  const wide = useIsWide();
  // The map only moves on purpose (a new area, "Use my location"), never after a tap or drag,
  // so it doesn't follow `value`. An existing garage opens on its own pin.
  const [initialPin] = useState(value);
  const [located, setLocated] = useState<{ at: Coords; area: Coords } | null>(null);
  const [locating, setLocating] = useState(false);
  const center = located?.area === fallbackCenter ? located.at : initialPin && !located ? initialPin : fallbackCenter;

  const locate = async () => {
    try {
      setLocating(true);
      const here = await getCurrentLocation();
      setLocated({ at: here, area: fallbackCenter }); // until the host picks another area
      onChange(here);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <AppMap center={center} zoom={16} picked={value} onPick={onChange} style={{ height: wide ? 320 : 240 }} />
        {!value ? (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>Tap the map where the garage is</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.row}>
        <Button title="Use my location" icon="locate" size="sm" variant="secondary" loading={locating} onPress={locate} />
        {value ? <Button title="Remove pin" size="sm" variant="ghost" onPress={() => onChange(null)} /> : null}
      </View>
      <Text style={styles.caption}>
        {value
          ? `Pin at ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}. Drag it to move it, or tap somewhere else.`
          : "Renters see the garage at this spot and get directions to it."}
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
    backgroundColor: colors.ink,
  },
  hintText: { ...typography.label, fontSize: 13, color: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  caption: { ...typography.caption, color: colors.textMuted },
});
