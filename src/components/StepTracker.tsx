import { Ionicons } from "@expo/vector-icons";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

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
                  <Ionicons name="checkmark" size={12} color={colors.onInk} />
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
  // Quieter than the content: small dots, caption labels, hairline connectors
  row: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sand,
  },
  dotDone: { backgroundColor: colors.textMuted },
  dotCurrent: { backgroundColor: colors.accent },
  num: { ...typography.caption, fontSize: 11, lineHeight: 14, color: colors.textMuted, ...typography.tabular },
  label: { ...typography.caption, color: colors.textMuted },
  line: { flex: 1, height: 1, marginHorizontal: 10, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.textMuted },
});
