import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconTile, SectionTitle, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DoorPanel, DoorVisual } from "../../components/DoorPanel";
import { canReview, ReviewBox } from "../../components/ReviewBox";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { t, useT } from "../../i18n";
import { translateError } from "../../i18n/errors";
import { getCommand, leaveEarly, myBookings, sendDoorCommand } from "../../services/garages";
import { cancelBooking } from "../../services/payments";
import { Booking, DoorAction } from "../../types/garage";
import { formatCents, formatDay, formatDuration, formatTime } from "../../utils/booking";

const POLL_MS = 1000;
const GIVE_UP_MS = 30000; // the server already fails a command after 20 s; this is a safety net

// Screen 3: the active booking with the Open button, then upcoming and past bookings
export default function Bookings() {
  useT(); // re-render in a new language
  const { data, loading, refreshing, error, reload, refresh } = useAsync(myBookings);
  const [now, setNow] = useState(() => new Date());

  useRefreshOnFocus(refresh);

  // Keeps "time left" and which booking is active up to date
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Most recently booked first, inside each section
  const bookings = [...(data ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const closed = (b: Booking) => b.status === "cancelled" || b.status === "expired";
  // Only a paid booking is active: that's the one the door opens for
  const isActive = (b: Booking) => b.status === "paid" && new Date(b.starts_at) <= now && new Date(b.ends_at) > now;
  const active = bookings.filter(isActive);
  const upcoming = bookings.filter((b) => !closed(b) && !isActive(b) && new Date(b.ends_at) > now);
  const past = bookings.filter((b) => closed(b) || new Date(b.ends_at) <= now);

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh} style={styles.page}>
      <Header title={t("bookings.title")} subtitle={active.length ? t("bookings.ready") : t("bookings.subtitle")} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !bookings.length ? (
        <EmptyState
          icon="car-outline"
          title={t("bookings.emptyTitle")}
          body={t("bookings.emptyBody")}
          actionLabel={t("bookings.findGarage")}
          onAction={() => router.navigate("/")}
        />
      ) : (
        <>
          {active.map((b) => (
            <ActiveBooking key={b.id} booking={b} now={now} onChanged={refresh} />
          ))}

          {upcoming.length ? (
            <>
              <SectionTitle>{t("bookings.upcoming")}</SectionTitle>
              {upcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  note={new Date(b.starts_at) > now ? t("bookings.startsIn", { time: formatDuration(new Date(b.starts_at).getTime() - now.getTime()) }) : undefined}
                  now={now}
                  onChanged={refresh}
                />
              ))}
            </>
          ) : null}

          {past.length ? (
            <>
              <SectionTitle muted>{t("bookings.past")}</SectionTitle>
              {past.map((b) => (
                <BookingRow key={b.id} booking={b} now={now} muted onReviewed={refresh} />
              ))}
            </>
          ) : null}
        </>
      )}
    </ScreenWrapper>
  );
}

type Door =
  | { phase: "idle" }
  | { phase: "busy"; action: DoorAction }
  | { phase: "done"; action: DoorAction; at: Date }
  | { phase: "error"; message: string };

function ActiveBooking({ booking, now, onChanged }: { booking: Booking; now: Date; onChanged: () => void }) {
  useT();
  const g = booking.garage;
  const [door, setDoor] = useState<Door>({ phase: "idle" });
  // Whether the last command that went through opened the door, so the button offers the other one
  const [isOpen, setIsOpen] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; // stop polling when the screen goes away
    };
  }, []);

  const send = async (action: DoorAction) => {
    if (!g) return;
    setDoor({ phase: "busy", action });
    try {
      const commandId = await sendDoorCommand(g.id, action);
      const startedAt = Date.now();
      while (alive.current && Date.now() - startedAt < GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const c = await getCommand(commandId);
        if (c.status === "opened") {
          const at = c.acked_at ? new Date(c.acked_at) : new Date();
          setDoor({ phase: "done", action, at });
          setIsOpen(action === "open");
          notify(doneLabel(action, at));
          return;
        }
        if (c.status === "error") throw new Error(c.error ? translateError(c.error) : t("door.failed"));
      }
      if (alive.current) throw new Error(t("door.noResponse"));
    } catch (e: any) {
      if (!alive.current) return;
      setDoor({ phase: "error", message: e.message });
      notify(e.message, "error");
    }
  };

  const left = new Date(booking.ends_at).getTime() - now.getTime();
  const app = g?.access === "app";
  const next: DoorAction = isOpen ? "close" : "open";

  // The door panel shows the physical door, derived from the command's status
  const visual: DoorVisual =
    door.phase === "busy" ? (door.action === "open" ? "opening" : "closing")
    : door.phase === "done" ? (door.action === "open" ? "open" : "closed")
    : door.phase === "error" ? "error"
    : isOpen ? "open" : "closed";
  const caption =
    door.phase === "busy" ? t("door.talking")
    : door.phase === "done" ? doneLabel(door.action, door.at)
    : door.phase === "error" ? door.message
    : t("door.standBy");

  return (
    <Card style={styles.active}>
      <View style={styles.activeHead}>
        <Text style={styles.activeTitle} numberOfLines={2}>
          {g?.title ?? t("bookings.garage")}
        </Text>
        <View style={styles.leftBox}>
          <Text style={styles.leftFigure}>{formatDuration(left)}</Text>
          <Text style={styles.caption}>{t("bookings.leftUntil", { time: formatTime(new Date(booking.ends_at)) })}</Text>
        </View>
      </View>

      {app ? (
        <>
          <DoorPanel visual={visual} restingOpen={isOpen} caption={caption} />
          <Button
            title={door.phase === "busy" ? busyLabel(door.action) : door.phase === "error" ? t("common.tryAgain") : next === "open" ? t("door.open") : t("door.close")}
            icon={next === "open" ? "lock-open" : "lock-closed"}
            // Yellow always means "open the door"; closing is the quiet light button
            variant={next === "open" ? "accent" : "primary"}
            loading={door.phase === "busy"}
            onPress={() => send(next)}
            style={styles.openBtn}
            accessibilityLabel={next === "open" ? t("door.openLabel") : t("door.closeLabel")}
          />
        </>
      ) : (
        <View style={styles.manual}>
          <IconTile icon="key" size={40} bg={colors.surface} />
          <Text style={[styles.body, { flex: 1 }]}>{t("bookings.manual")}</Text>
        </View>
      )}

      <Text style={styles.paidLine}>
        {t("bookings.paidWith", { amount: formatCents(amountOf(booking)), method: paidWith(booking) })}
      </Text>
      <ReviewBox booking={booking} onSaved={onChanged} />
      <LeaveEarly booking={booking} doorOpen={app && isOpen} onLeft={onChanged} />
    </Card>
  );
}

// Ends the booking now so the rest of the time frees up for others. No refund.
function LeaveEarly({ booking, doorOpen, onLeft }: { booking: Booking; doorOpen: boolean; onLeft: () => void }) {
  useT();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    try {
      setLeaving(true);
      await leaveEarly(booking.id);
      notify(t("bookings.leftDone"));
      onLeft();
    } catch (e: any) {
      notify(e.message, "error");
      setLeaving(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return <Button title={t("bookings.leave")} icon="exit-outline" size="sm" variant="ghost" onPress={() => setConfirming(true)} style={styles.cancelBtn} />;
  }
  return (
    <View style={styles.leave}>
      <Text style={styles.body}>{t("bookings.leaveConfirm")}</Text>
      {booking.garage?.access === "app" ? (
        <Text style={[styles.caption, doorOpen && { color: colors.errorText }]}>{t("bookings.leaveDoor")}</Text>
      ) : null}
      <View style={styles.leaveActions}>
        <Button title={t("bookings.stay")} size="sm" variant="ghost" disabled={leaving} onPress={() => setConfirming(false)} />
        <Button title={t("bookings.leaveYes")} size="sm" variant="danger" loading={leaving} onPress={leave} />
      </View>
    </View>
  );
}

// Same verb through the flow: Open -> Opening… -> Opened 02:37
const busyLabel = (a: DoorAction) => (a === "open" ? t("door.opening") : t("door.closing"));
const doneLabel = (a: DoorAction, at: Date) => t(a === "open" ? "door.openedAt" : "door.closedAt", { time: formatTime(at) });

const amountOf = (b: Booking) => b.amount_cents ?? Math.round(b.total_price * 100);

const paidWith = (b: Booking) =>
  b.payment?.method === "wallet"
    ? t("pay.demoWallet")
    : b.payment?.card_last4
      ? `${b.payment.card_brand ?? t("pay.card")} •••• ${b.payment.card_last4}`
      : t("pay.card");

// Status chip for a booking row: Paid / Refunded / Cancelled / Expired / Not paid
function statusTag(b: Booking): { label: string; bg: string; color: string } {
  if (b.status === "paid") return { label: t("status.paid"), bg: colors.successSoft, color: colors.success };
  if (b.status === "cancelled" && b.payment?.status === "refunded") return { label: t("status.refunded"), bg: colors.accentSoft, color: colors.accentDeep };
  if (b.status === "cancelled") return { label: t("status.cancelled"), bg: colors.sand, color: colors.textMuted };
  if (b.status === "expired") return { label: t("status.expired"), bg: colors.sand, color: colors.textMuted };
  return { label: t("status.notPaid"), bg: colors.errorSoft, color: colors.errorText };
}

type RowProps = { booking: Booking; now: Date; note?: string; muted?: boolean; onChanged?: () => void; onReviewed?: () => void };

function BookingRow({ booking, now, note, muted, onChanged, onReviewed }: RowProps) {
  useT();
  const g = booking.garage;
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const tag = statusTag(booking);
  const amount = amountOf(booking);
  // Paid: cancel (and refund) only before it starts. Unpaid: cancel any time to free the slot.
  const canCancel =
    !!onChanged && (booking.status === "pending_payment" || (booking.status === "paid" && new Date(booking.starts_at) > now));

  const cancel = async () => {
    try {
      setCancelling(true);
      const r = await cancelBooking(booking.id);
      notify(r.refund ? t("bookings.refunded", { amount: formatCents(r.refunded_cents) }) : t("bookings.cancelled"));
      onChanged?.();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  const inAt = new Date(booking.starts_at);
  const outAt = new Date(booking.ends_at);
  const shown = note ?? (booking.left_early_at ? t("bookings.leftEarly", { time: formatTime(new Date(booking.left_early_at)) }) : undefined);

  // A parking ticket: In and Out times on top, a tear line, then what it is and what it cost
  return (
    <View style={styles.ticket}>
      <View style={[styles.times, muted && styles.dim]}>
        <TicketTime label={t("ticket.in")} at={inAt} />
        <TicketTime label={t("ticket.out")} at={outAt} />
      </View>

      <Perforation />

      <View style={[styles.stub, muted && styles.dim]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {g?.title ?? t("bookings.garage")}
          </Text>
          <View style={styles.tagRow}>
            <Tag label={tag.label} bg={tag.bg} color={tag.color} />
            {booking.payment && booking.status !== "pending_payment" && booking.status !== "expired" ? (
              <Text style={styles.caption}>{paidWith(booking)}</Text>
            ) : null}
          </View>
          {shown ? <Text style={styles.note}>{shown}</Text> : null}
        </View>
        <Text style={[styles.price, booking.status === "cancelled" && styles.struck]}>{formatCents(amount)}</Text>
      </View>

      {canCancel ? (
        confirming ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.caption, { flex: 1 }]}>
              {booking.status === "paid" ? t("bookings.confirmRefund", { amount: formatCents(amount) }) : t("bookings.confirmFree")}
            </Text>
            <Button title={t("bookings.keep")} size="sm" variant="ghost" disabled={cancelling} onPress={() => setConfirming(false)} />
            <Button title={t("bookings.cancel")} size="sm" variant="danger" loading={cancelling} onPress={cancel} />
          </View>
        ) : (
          <Button title={t("bookings.cancel")} size="sm" variant="ghost" icon="close-circle" onPress={() => setConfirming(true)} style={styles.cancelBtn} />
        )
      ) : null}

      {canReview(booking, now) ? <ReviewBox booking={booking} onSaved={onReviewed ?? onChanged} /> : null}
    </View>
  );
}

function TicketTime({ label, at }: { label: string; at: Date }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.ticketTime}>{formatTime(at)}</Text>
      <Text style={styles.caption}>{formatDay(at)}</Text>
    </View>
  );
}

// The tear line: punched holes in the ground colour, with a notch cut into each edge
const HOLES = 14;
function Perforation() {
  return (
    <View style={styles.perf} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.notch, { left: -9 }]} />
      {Array.from({ length: HOLES }, (_, i) => (
        <View key={i} style={styles.hole} />
      ))}
      <View style={[styles.notch, { right: -9 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 760, width: "100%", alignSelf: "center" },
  active: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.xl },
  activeHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  activeTitle: { ...typography.h2, color: colors.ink, flex: 1 },
  leftBox: { alignItems: "flex-end" },
  leftFigure: { ...typography.figureSm, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.ink },
  openBtn: { minHeight: 72, marginTop: spacing.md },
  manual: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.sand,
  },
  ticket: { marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14, gap: 12, borderRadius: radius.lg, backgroundColor: colors.surface },
  times: { flexDirection: "row", gap: spacing.md },
  ticketTime: { ...typography.figure, fontSize: 32, lineHeight: 36, color: colors.ink },
  perf: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -spacing.md, paddingHorizontal: 18, height: 18 },
  notch: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  hole: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.background },
  stub: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTitle: { ...typography.h3, color: colors.ink },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginTop: 2 },
  note: { ...typography.label, color: colors.accentDeep },
  price: { ...typography.figureSm, color: colors.ink },
  struck: { textDecorationLine: "line-through", color: colors.textMuted },
  paidLine: { ...typography.label, color: colors.success },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  cancelBtn: { alignSelf: "flex-start" },
  leave: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.errorSoft },
  leaveActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  dim: { opacity: 0.7 },
});
