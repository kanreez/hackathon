import { Ionicons } from "@expo/vector-icons";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../constants/theme";

const STEPS = ["Find", "Book", "Open"];

// The renter flow at a glance: 1 Find → 2 Book → 3 Open
export function StepTracker({ active, steps = STEPS }: { active: number; steps?: string[] }) {
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${active + 1} of ${steps.length}: ${steps[active]}`}
    >
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <Fragment key={label}>
            {i > 0 ? <View style={[styles.line, i <= active && styles.lineDone]} /> : null}
            <View style={styles.step}>
              <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color={colors.onInk} />
                ) : (
                  <Text style={[styles.num, current && { color: colors.onAccent }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.label, (done || current) && { color: colors.ink }]}>{label}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sand,
  },
  dotDone: { backgroundColor: colors.ink },
  dotCurrent: { backgroundColor: colors.accent },
  num: { ...typography.label, fontSize: 12, color: colors.textMuted },
  label: { ...typography.label, color: colors.textMuted },
  line: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 10, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.ink },
});
