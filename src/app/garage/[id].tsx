import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ComponentProps, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { IconTile, SectionTitle } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { StepTracker } from "../../components/StepTracker";
import { notify } from "../../components/Toast";
import { ACCESS_META, SIZE_META } from "../../constants/garages";
import { colors, radius, shadow, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { createBooking, getGarage } from "../../services/garages";
import { BookingMode, BusySlot, Garage } from "../../types/garage";
import {
  addDays,
  addHours,
  DAY_MS,
  formatDay,
  formatMoney,
  formatRange,
  formatTime,
  HOUR_MS,
  overlaps,
  priceFor,
  startOfDay,
  startOfHour,
} from "../../utils/booking";
import { openDirections } from "../../utils/maps";

type IconName = ComponentProps<typeof Ionicons>["name"];

const MODES = [
  { value: "hour", label: "By the hour" },
  { value: "day", label: "By the day" },
] as const;

const DAYS_AHEAD = 14;

// Screen 2: the garage, a time picker, the total, and Confirm. The AI never books: this tap does.
export default function Book() {
  const { id, from, to } = useLocalSearchParams<{ id: string; from?: string; to?: string }>();
  const { data, loading, error, reload } = useAsync(() => getGarage(id), [id]);

  if (loading) {
    return (
      <ScreenWrapper>
        <Header title="Book" back />
        <Loading />
      </ScreenWrapper>
    );
  }
  if (error || !data) {
    return (
      <ScreenWrapper>
        <Header title="Book" back />
        <ErrorState message={error ?? "Garage not found"} onRetry={reload} />
      </ScreenWrapper>
    );
  }
  return <BookForm garage={data.garage} busy={data.busy} from={from} to={to} />;
}

// Where the picker starts: the time the AI understood if there was one, else from this hour
function initialPick(from?: string, to?: string) {
  const minStart = startOfHour(new Date());
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  if (f && t && t > f && t > minStart) {
    const span = t.getTime() - f.getTime();
    if (f.getHours() === 0 && span >= DAY_MS - HOUR_MS) {
      return { mode: "day" as BookingMode, day: startOfDay(f), startHour: 0, hours: 2, days: Math.max(1, Math.round(span / DAY_MS)) };
    }
    const start = f < minStart ? minStart : f;
    return {
      mode: "hour" as BookingMode,
      day: startOfDay(start),
      startHour: start.getHours(),
      hours: Math.max(1, Math.ceil((t.getTime() - start.getTime()) / HOUR_MS)),
      days: 1,
    };
  }
  return { mode: "hour" as BookingMode, day: startOfDay(minStart), startHour: minStart.getHours(), hours: 2, days: 1 };
}

function BookForm({ garage, busy, from, to }: { garage: Garage; busy: BusySlot[]; from?: string; to?: string }) {
  const [initial] = useState(() => initialPick(from, to));
  const [mode, setMode] = useState<BookingMode>(initial.mode);
  const [day, setDay] = useState(initial.day);
  const [startHour, setStartHour] = useState(initial.startHour);
  const [hours, setHours] = useState(initial.hours);
  const [days, setDays] = useState(initial.days);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const minStart = startOfHour(now);
  const isToday = startOfDay(now).getTime() === day.getTime();
  const firstHour = isToday ? minStart.getHours() : 0;
  const hour = Math.max(startHour, firstHour); // a day change can leave the old hour in the past

  let start: Date;
  let end: Date;
  if (mode === "hour") {
    start = new Date(day);
    start.setHours(hour);
    end = addHours(start, hours);
  } else {
    start = isToday ? minStart : day; // today's day booking starts now, not at midnight
    end = addDays(day, days);
  }
  const total = priceFor(garage, start, end, mode);
  const clash = busy.find((b) => overlaps(start, end, b));
  const dayOptions = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(now), i));

  const confirm = async () => {
    try {
      setSaving(true);
      await createBooking(garage.id, start, end, mode);
      notify(`Booked: ${formatRange(start, end)}`);
      router.replace("/bookings");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const app = garage.access === "app";

  return (
    <ScreenWrapper scroll>
      <Header title={garage.title} subtitle={[garage.area, garage.address].filter(Boolean).join(" · ")} back />
      <StepTracker active={1} />

      {garage.image_url ? <Image source={{ uri: garage.image_url }} style={styles.photo} contentFit="cover" /> : null}

      <Card style={styles.facts}>
        <Fact icon="resize" label="Size" value={`${SIZE_META[garage.size].label} · ${SIZE_META[garage.size].hint}`} />
        <Fact icon={garage.covered ? "umbrella" : "sunny"} label="Type" value={garage.covered ? "Covered" : "Open-air"} divider />
        <Fact icon={app ? "phone-portrait" : "key"} label="Access" value={ACCESS_META[garage.access].label} hint={ACCESS_META[garage.access].hint} divider accent={app} />
        <Fact icon="cash" label="Price" value={`${formatMoney(garage.price_hour)} per hour · ${formatMoney(garage.price_day)} per day`} divider />
        <Button title="Directions" icon="navigate" variant="secondary" size="sm" onPress={() => openDirections(garage)} style={{ alignSelf: "flex-start", marginTop: spacing.sm }} />
      </Card>

      <SectionTitle>When?</SectionTitle>
      <ChipRow options={MODES} value={mode} onChange={setMode} />

      <Text style={styles.label}>{mode === "hour" ? "Day" : "From"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {dayOptions.map((d) => {
          const selected = d.getTime() === day.getTime();
          const [top, bottom] = formatDay(d, now).split(/ (?=\d)/); // "Sat" / "31 Oct", or "Today"
          return (
            <Pressable
              key={d.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatDay(d, now)}
              onPress={() => setDay(d)}
              style={({ pressed }) => [styles.dayTile, selected && styles.dayTileOn, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Text style={[styles.dayTop, selected && { color: colors.white }]}>{top}</Text>
              <Text style={[styles.dayBottom, selected && { color: colors.border }]}>{bottom ?? " "}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card style={styles.steppers}>
        {mode === "hour" ? (
          <>
            <Stepper
              label="Start"
              value={formatTime(start)}
              onMinus={() => setStartHour(hour - 1)}
              onPlus={() => setStartHour(hour + 1)}
              canMinus={hour > firstHour}
              canPlus={hour < 23}
            />
            <Stepper
              label="For"
              value={`${hours} h`}
              onMinus={() => setHours(hours - 1)}
              onPlus={() => setHours(hours + 1)}
              canMinus={hours > 1}
              canPlus={hours < 24}
              divider
            />
          </>
        ) : (
          <Stepper
            label="For"
            value={`${days} ${days === 1 ? "day" : "days"}`}
            onMinus={() => setDays(days - 1)}
            onPlus={() => setDays(days + 1)}
            canMinus={days > 1}
            canPlus={days < 14}
          />
        )}
      </Card>

      <View style={styles.summary}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>Your booking</Text>
          <Text style={styles.range}>{formatRange(start, end)}</Text>
        </View>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>

      {clash ? (
        <View style={styles.clash} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.clashText}>Already booked {formatRange(clash.starts_at, clash.ends_at)}. Pick another time.</Text>
        </View>
      ) : null}

      <Button
        title={`Confirm · ${formatMoney(total)}`}
        icon="checkmark"
        variant="accent"
        loading={saving}
        disabled={!!clash}
        onPress={confirm}
        style={{ marginTop: spacing.lg }}
      />
      <Text style={styles.note}>
        {app ? "When your booking starts, open the door from My bookings." : "The host will let you in at the start time."}
      </Text>
    </ScreenWrapper>
  );
}

function Fact({ icon, label, value, hint, divider, accent }: { icon: IconName; label: string; value: string; hint?: string; divider?: boolean; accent?: boolean }) {
  return (
    <View style={[styles.fact, divider && styles.divider]}>
      <IconTile icon={icon} size={40} bg={accent ? colors.accent : colors.sand} />
      <View style={{ flex: 1 }}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
        {hint ? <Text style={styles.factLabel}>{hint}</Text> : null}
      </View>
    </View>
  );
}

type StepperProps = {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  canMinus: boolean;
  canPlus: boolean;
  divider?: boolean;
};

function Stepper({ label, value, onMinus, onPlus, canMinus, canPlus, divider }: StepperProps) {
  return (
    <View style={[styles.stepper, divider && styles.divider]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <StepButton icon="remove" label={`Less ${label.toLowerCase()}`} onPress={onMinus} disabled={!canMinus} />
      <Text style={styles.stepperValue}>{value}</Text>
      <StepButton icon="add" label={`More ${label.toLowerCase()}`} onPress={onPlus} disabled={!canPlus} />
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
      style={({ pressed }) => [styles.stepBtn, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { height: 200, borderRadius: radius.xl, backgroundColor: colors.sand, marginBottom: spacing.md },
  facts: { padding: spacing.lg, gap: 0 },
  fact: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  factLabel: { ...typography.caption, color: colors.textMuted },
  factValue: { ...typography.h3, color: colors.ink },
  label: { ...typography.label, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  days: { gap: spacing.sm, paddingRight: spacing.lg },
  dayTile: {
    width: 76,
    minHeight: 64,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  dayTileOn: { backgroundColor: colors.ink },
  dayTop: { ...typography.label, color: colors.ink },
  dayBottom: { ...typography.caption, color: colors.textMuted },
  steppers: { marginTop: spacing.md, paddingVertical: spacing.xs },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64 },
  stepperLabel: { ...typography.h3, color: colors.ink, flex: 1 },
  stepperValue: { ...typography.h2, color: colors.ink, minWidth: 72, textAlign: "center" },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accentDeep },
  range: { ...typography.h3, color: colors.ink },
  total: { ...typography.h1, color: colors.ink },
  clash: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
  },
  clashText: { ...typography.label, color: colors.error, flex: 1 },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
