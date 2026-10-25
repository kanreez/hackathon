import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ComponentProps, useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { SectionTitle } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { Header } from "../../components/Header";
import { AppMap } from "../../components/map/AppMap";
import { PaySheet } from "../../components/PaySheet";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Stars } from "../../components/Stars";
import { ErrorState, Loading } from "../../components/StateViews";
import { StepTracker } from "../../components/StepTracker";
import { notify } from "../../components/Toast";
import { areaLabel, SIZE_META } from "../../constants/garages";
import { colors, radius, shadow, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useIsWide } from "../../hooks/useIsWide";
import { useT } from "../../i18n";
import { createBooking, getGarage } from "../../services/garages";
import { cancelBooking } from "../../services/payments";
import { BookingMode, BusySlot, Checkout, Garage, RatingSummary, Review } from "../../types/garage";
import {
  addDays,
  addHours,
  DAY_MS,
  formatCents,
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
import { isAvailable, summarizeAvailability } from "../../utils/availability";
import { openDirections } from "../../utils/maps";
import { timeAgo } from "../../utils/time";

type IconName = ComponentProps<typeof Ionicons>["name"];


const DAYS_AHEAD = 14;

// Screen 2: the garage, a time picker, the total, and Confirm. The AI never books: this tap does.
export default function Book() {
  const { id, from, to } = useLocalSearchParams<{ id: string; from?: string; to?: string }>();
  const { t } = useT();
  const { data, loading, error, reload } = useAsync(() => getGarage(id), [id]);

  if (loading) {
    return (
      <ScreenWrapper>
        <Header title={t("book.title")} back />
        <Loading />
      </ScreenWrapper>
    );
  }
  if (error || !data) {
    return (
      <ScreenWrapper>
        <Header title={t("book.title")} back />
        <ErrorState message={error ?? t("err.garageNotFound")} onRetry={reload} />
      </ScreenWrapper>
    );
  }
  return <BookForm garage={data.garage} busy={data.busy} reviews={data.reviews ?? []} from={from} to={to} />;
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

function BookForm({ garage, busy, reviews, from, to }: { garage: Garage; busy: BusySlot[]; reviews: Review[]; from?: string; to?: string }) {
  const { t, tn } = useT();
  const modes = [
    { value: "hour", label: t("book.byHour") },
    { value: "day", label: t("book.byDay") },
  ] as const;
  const [initial] = useState(() => initialPick(from, to));
  const [mode, setMode] = useState<BookingMode>(initial.mode);
  const [day, setDay] = useState(initial.day);
  const [startHour, setStartHour] = useState(initial.startHour);
  const [hours, setHours] = useState(initial.hours);
  const [days, setDays] = useState(initial.days);
  const [saving, setSaving] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const wide = useIsWide();

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
  const outsideHours = !isAvailable(garage, start, end);
  const dayOptions = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(now), i));

  // Confirm creates the booking unpaid (slot held 10 min) and opens the pay sheet
  const confirm = async () => {
    try {
      setSaving(true);
      setCheckout(await createBooking(garage.id, start, end, mode));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const paid = () => {
    notify(t("book.paidAndBooked", { range: formatRange(start, end) }));
    setCheckout(null);
    router.replace("/bookings");
  };

  // Backed out of paying: free the slot now instead of holding it for 10 minutes
  const closeSheet = () => {
    if (checkout) cancelBooking(checkout.booking_id).catch(() => {});
    setCheckout(null);
  };

  const expired = useCallback(() => {
    setCheckout(null);
    notify(t("book.expired"), "error");
  }, [t]);

  const app = garage.access === "app";
  const spot = garage.latitude != null && garage.longitude != null ? { latitude: garage.latitude, longitude: garage.longitude } : null;

  const details = (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{garage.title}</Text>
        <Text style={styles.heroBody}>{garage.address ? `${garage.address}, ${areaLabel(garage.area)}` : areaLabel(garage.area)}</Text>
        <View style={styles.access}>
          {app ? <View style={styles.bayLine} /> : null}
          <Text style={[styles.accessText, app && { color: colors.cta }]}>
            {app ? t("book.accessApp") : t("book.accessManual")}
          </Text>
        </View>
      </View>

      {garage.image_url ? <Image source={{ uri: garage.image_url }} style={styles.photo} contentFit="cover" /> : null}

      <View style={styles.facts}>
        <Fact label={t("book.size")} value={t("book.sizeValue", { size: SIZE_META[garage.size].label, fits: SIZE_META[garage.size].fits })} />
        <Fact label={t("book.type")} value={garage.covered ? t("garage.covered") : t("garage.openAir")} />
        <Fact label={t("book.perHour")} value={formatMoney(garage.price_hour)} figure />
        <Fact label={t("book.perDay")} value={formatMoney(garage.price_day)} figure />
        <Fact label={t("book.free")} value={summarizeAvailability(garage.availability)} />
      </View>
      {garage.description ? <Text style={styles.description}>{garage.description}</Text> : null}
      <Button title={t("book.directions")} icon="navigate" variant="secondary" size="sm" onPress={() => openDirections(garage)} style={{ alignSelf: "flex-start", marginTop: spacing.md }} />

      {spot ? (
        // A still preview: where it is at a glance; Directions opens Google Maps for the route
        <AppMap center={spot} zoom={16} picked={spot} interactive={false} style={styles.map} />
      ) : null}

      <Reviews rating={garage.rating} reviews={reviews} />
    </>
  );

  const booking = (
    <>
      <SectionTitle>{t("book.when")}</SectionTitle>
      <ChipRow options={modes} value={mode} onChange={setMode} />

      <Text style={styles.label}>{mode === "hour" ? t("book.day") : t("book.from")}</Text>
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
              <Text style={styles.dayTop}>{top}</Text>
              <Text style={[styles.dayBottom, selected && { color: colors.accentDeep }]}>{bottom ?? " "}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card style={styles.steppers}>
        {mode === "hour" ? (
          <>
            <Stepper
              label={t("book.start")}
              value={formatTime(start)}
              onMinus={() => setStartHour(hour - 1)}
              onPlus={() => setStartHour(hour + 1)}
              canMinus={hour > firstHour}
              canPlus={hour < 23}
            />
            <Stepper
              label={t("book.for")}
              value={t("duration.h", { h: hours })}
              onMinus={() => setHours(hours - 1)}
              onPlus={() => setHours(hours + 1)}
              canMinus={hours > 1}
              canPlus={hours < 24}
              divider
            />
          </>
        ) : (
          <Stepper
            label={t("book.for")}
            value={tn("duration.days", days)}
            onMinus={() => setDays(days - 1)}
            onPlus={() => setDays(days + 1)}
            canMinus={days > 1}
            canPlus={days < 14}
          />
        )}
      </Card>

      <View style={styles.summary}>
        <Text style={styles.range}>{formatRange(start, end)}</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>

      {clash ? (
        <View style={styles.clash} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.errorText} />
          <Text style={styles.clashText}>{t("book.clash", { range: formatRange(clash.starts_at, clash.ends_at) })}</Text>
        </View>
      ) : outsideHours ? (
        <View style={styles.clash} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.errorText} />
          <Text style={styles.clashText}>
            {t("book.outsideHours", { hours: summarizeAvailability(garage.availability) })}
          </Text>
        </View>
      ) : null}

      <Button
        title={t("book.submit", { price: formatMoney(total) })}
        icon="checkmark"
        variant="accent"
        loading={saving}
        disabled={!!clash || outsideHours}
        onPress={confirm}
        style={{ marginTop: spacing.lg }}
      />
      <Text style={styles.note}>
        {t("book.payNext")} {app ? t("book.noteApp") : t("book.noteManual")}
      </Text>
    </>
  );

  // "2 h × €3 = €6", from the server's numbers once the booking exists
  const breakdown = checkout
    ? `${checkout.unit === "hour" ? t("duration.h", { h: checkout.units }) : tn("duration.days", checkout.units)} × ${formatCents(checkout.unit_price_cents)} = ${formatCents(checkout.amount_cents)}`
    : "";
  const sheet = (
    <PaySheet
      key={checkout?.booking_id ?? "closed"}
      checkout={checkout}
      title={garage.title}
      range={formatRange(start, end)}
      breakdown={breakdown}
      onPaid={paid}
      onClose={closeSheet}
      onExpired={expired}
    />
  );

  return (
    <ScreenWrapper scroll>
      <Header title={t("book.screenTitle")} back />
      <StepTracker active={1} />

      {wide ? (
        // PC: garage details on the left, the booking panel beside them
        <View style={styles.columns}>
          <View style={styles.detailsColumn}>{details}</View>
          <View style={[styles.bookingPanel, stickyOnWeb]}>{booking}</View>
        </View>
      ) : (
        <>
          {details}
          {booking}
        </>
      )}
      {sheet}
    </ScreenWrapper>
  );
}

function Fact({ label, value, figure }: { label: string; value: string; figure?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, figure && styles.factFigure]}>{value}</Text>
    </View>
  );
}

// What renters who parked here said: the average large, then each review as a flat row
function Reviews({ rating, reviews }: { rating?: RatingSummary; reviews: Review[] }) {
  const { t, tn } = useT();
  return (
    <>
      <SectionTitle>{t("reviews.title")}</SectionTitle>
      {rating?.count && rating.average != null ? (
        <View style={styles.ratingHead}>
          <Text style={styles.ratingFigure}>{rating.average.toFixed(1)}</Text>
          <View style={{ gap: 4 }}>
            <Stars value={rating.average} size={16} />
            <Text style={styles.factLabel}>
              {tn("reviews.fromRenters", rating.count)}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.description}>{t("reviews.none")}</Text>
      )}
      {reviews.map((r) => (
        <View key={r.id} style={styles.review}>
          <View style={styles.reviewHead}>
            <Stars value={r.rating} size={13} />
            <Text style={styles.reviewAuthor}>{r.author_name}</Text>
            <Text style={styles.factLabel}>{timeAgo(r.created_at)}</Text>
          </View>
          {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
        </View>
      ))}
    </>
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
  const { t } = useT();
  return (
    <View style={[styles.stepper, divider && styles.divider]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <StepButton icon="remove" label={t("book.less", { what: label.toLowerCase() })} onPress={onMinus} disabled={!canMinus} />
      <Text style={styles.stepperValue}>{value}</Text>
      <StepButton icon="add" label={t("book.more", { what: label.toLowerCase() })} onPress={onPlus} disabled={!canPlus} />
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
      style={({ pressed }) => [styles.stepBtn, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

// position: sticky only exists on web; react-native-web passes it through
const stickyOnWeb = (Platform.OS === "web" ? { position: "sticky", top: spacing.lg } : null) as ViewStyle | null;

const styles = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  map: { height: 200, marginTop: spacing.md },
  detailsColumn: { flex: 1, minWidth: 0 },
  // "When?" opens with its own top margin, so the panel needs no top padding
  bookingPanel: {
    width: 460,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hero: { gap: spacing.xs, marginBottom: spacing.lg },
  heroTitle: { ...typography.h1, color: colors.ink },
  heroBody: { ...typography.body, color: colors.textMuted },
  access: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  // The same painted bay line as the list rows
  bayLine: { width: 2, alignSelf: "stretch", borderRadius: 1, backgroundColor: colors.cta },
  accessText: { ...typography.label, color: colors.textMuted, flex: 1 },
  photo: { height: 200, borderRadius: radius.xl, backgroundColor: colors.sand, marginBottom: spacing.md },
  facts: { borderTopWidth: 1, borderTopColor: colors.border },
  fact: { flexDirection: "row", alignItems: "baseline", gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  factLabel: { ...typography.label, color: colors.textMuted, width: 84 },
  factValue: { ...typography.h3, color: colors.ink, flex: 1 },
  factFigure: { ...typography.figureSm },
  ratingHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  ratingFigure: { ...typography.figure, color: colors.ink },
  review: { gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  reviewAuthor: { ...typography.label, color: colors.ink },
  reviewText: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  days: { gap: spacing.sm, paddingRight: spacing.lg },
  dayTile: {
    width: 76,
    minHeight: 64,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  dayTileOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
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
  range: { ...typography.h3, color: colors.ink, flex: 1, ...typography.tabular },
  total: { ...typography.figure, color: colors.ink },
  clash: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
  },
  clashText: { ...typography.label, color: colors.errorText, flex: 1 },
  description: { ...typography.body, color: colors.ink, marginTop: spacing.md },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
