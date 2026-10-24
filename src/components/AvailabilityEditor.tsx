import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { AvailabilityWindow } from "../types/garage";
import { DAY_SHORT, formatHour, WEEK } from "../utils/availability";
import { Chip, ChipRow } from "./Chip";

type IconName = ComponentProps<typeof Ionicons>["name"];

const MODE_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "set", label: "Set hours" },
] as const;

// What "Set hours" starts with: the garage is empty while the host is at work
const WORKDAYS: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((day) => ({ day, start: 8, end: 18 }));

type Props = {
  value: AvailabilityWindow[] | null; // null = free any time
  onChange: (value: AvailabilityWindow[] | null) => void;
  error?: string;
};

// Host side: when the garage is empty and can be rented. One time range per day, whole hours.
export function AvailabilityEditor({ value, onChange, error }: Props) {
  // Switching to "Any time" and back keeps the hours the host already set
  const [lastSet, setLastSet] = useState<AvailabilityWindow[]>(value ?? WORKDAYS);

  const set = (next: AvailabilityWindow[]) => {
    const sorted = [...next].sort((a, b) => a.day - b.day);
    setLastSet(sorted);
    onChange(sorted);
  };

  const byDay = new Map((value ?? []).map((w) => [w.day, w]));
  const toggle = (day: number) => {
    if (byDay.has(day)) set((value ?? []).filter((w) => w.day !== day));
    else set([...(value ?? []), { day, start: 8, end: 18 }]);
  };
  const change = (day: number, patch: Partial<AvailabilityWindow>) =>
    set((value ?? []).map((w) => (w.day === day ? { ...w, ...patch } : w)));

  return (
    <View style={{ gap: spacing.sm }}>
      <ChipRow options={MODE_OPTIONS} value={value ? "set" : "any"} onChange={(m) => onChange(m === "any" ? null : lastSet)} />
      {value ? (
        <View style={styles.days}>
          {WEEK.map((day) => {
            const w = byDay.get(day);
            return (
              <View key={day} style={styles.day}>
                <View style={styles.dayChip}>
                  <Chip label={DAY_SHORT[day]} selected={!!w} onPress={() => toggle(day)} />
                </View>
                {w ? (
                  <View style={styles.hours}>
                    <HourStep
                      label={`${DAY_SHORT[day]} from`}
                      value={w.start}
                      onChange={(start) => change(day, { start })}
                      min={0}
                      max={w.end - 1}
                    />
                    <Text style={styles.dash}>–</Text>
                    <HourStep label={`${DAY_SHORT[day]} until`} value={w.end} onChange={(end) => change(day, { end })} min={w.start + 1} max={24} />
                  </View>
                ) : (
                  <Text style={styles.off}>Not free</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.caption}>
        {value
          ? "Tap a day to turn it on or off. Renters can only book inside these hours (Sofia time)."
          : "Renters can book any hour that isn't already booked."}
      </Text>
    </View>
  );
}

function HourStep({ label, value, onChange, min, max }: { label: string; value: number; onChange: (h: number) => void; min: number; max: number }) {
  return (
    <View style={styles.step} accessibilityLabel={`${label} ${formatHour(value)}`}>
      <StepButton icon="remove" label={`Earlier ${label}`} disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text style={styles.hour}>{formatHour(value)}</Text>
      <StepButton icon="add" label={`Later ${label}`} disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.stepBtn, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <Ionicons name={icon} size={16} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  days: { gap: 6 },
  day: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  dayChip: { width: 72 },
  hours: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, flexWrap: "wrap" },
  step: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  hour: { ...typography.label, color: colors.ink, minWidth: 44, textAlign: "center" },
  dash: { ...typography.label, color: colors.textMuted },
  off: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.errorText },
  caption: { ...typography.caption, color: colors.textMuted },
});
