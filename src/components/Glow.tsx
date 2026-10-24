import { StyleSheet, View } from "react-native";
import { colors } from "../constants/theme";

type Corner = "topRight" | "bottomLeft" | "center";

// Biggest and faintest first, so the middle reads brightest. No gradient library needed.
const RINGS = [
  { size: 520, opacity: 0.05 },
  { size: 380, opacity: 0.08 },
  { size: 260, opacity: 0.12 },
  { size: 160, opacity: 0.18 },
];

// Where the rings' shared centre sits, relative to the screen: partly off-screen at a corner
const CENTRES: Record<Corner, { top?: number | `${number}%`; bottom?: number; left?: number | `${number}%`; right?: number }> = {
  topRight: { top: -40, right: -60 },
  bottomLeft: { bottom: -40, left: -60 },
  center: { top: 220, left: "50%" },
};

// The soft orange corner glow from the template. Put it first inside the screen so content draws on top.
export function Glow({ corner }: { corner: Corner }) {
  const c = CENTRES[corner];
  return (
    // Clipped, so the rings never widen the page (a sideways scroll on web)
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.centre, c]}>
        {RINGS.map((r) => (
          <View
            key={r.size}
            style={[
              styles.ring,
              { width: r.size, height: r.size, borderRadius: r.size / 2, marginLeft: -r.size / 2, marginTop: -r.size / 2, opacity: r.opacity },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  centre: { position: "absolute", width: 0, height: 0 },
  ring: { position: "absolute", backgroundColor: colors.accent },
});
