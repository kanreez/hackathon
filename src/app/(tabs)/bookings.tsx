import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconTile, SectionTitle, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DoorPanel, DoorVisual } from "../../components/DoorPanel";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { getCommand, myBookings, sendDoorCommand } from "../../services/garages";
import { cancelBooking } from "../../services/payments";
import { Booking, DoorAction } from "../../types/garage";
import { formatCents, formatDuration, formatRange, formatTime } from "../../utils/booking";

const POLL_MS = 1000;
const GIVE_UP_MS = 30000; // the server already fails a command after 20 s; this is a safety net

// Screen 3: the active booking with the Open button, then upcoming and past bookings
export default function Bookings() {
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
      <Header title="My bookings" subtitle={active.length ? "Your garage is ready" : "Book a garage, then open it here"} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !bookings.length ? (
        <EmptyState
          icon="car-outline"
          title="No bookings yet"
          body="Find a garage, pick a time and confirm. Your booking and the Open button show up here."
          actionLabel="Find a garage"
          onAction={() => router.navigate("/")}
        />
      ) : (
        <>
          {active.map((b) => (
            <ActiveBooking key={b.id} booking={b} now={now} />
          ))}

          {upcoming.length ? (
            <>
              <SectionTitle>Upcoming</SectionTitle>
              {upcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  note={new Date(b.starts_at) > now ? `Starts in ${formatDuration(new Date(b.starts_at).getTime() - now.getTime())}` : undefined}
                  now={now}
                  onChanged={refresh}
                />
              ))}
            </>
          ) : null}

          {past.length ? (
            <>
              <SectionTitle muted>Past</SectionTitle>
              {past.map((b) => (
                <BookingRow key={b.id} booking={b} now={now} muted />
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

function ActiveBooking({ booking, now }: { booking: Booking; now: Date }) {
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
          notify(`${DONE_LABEL[action]} ${formatTime(at)}`);
          return;
        }
        if (c.status === "error") throw new Error(c.error ?? `The door couldn't be ${DONE_LABEL[action].toLowerCase()}`);
      }
      if (alive.current) throw new Error("The door didn't respond. Try again.");
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
    door.phase === "busy" ? "Talking to the door…"
    : door.phase === "done" ? `${DONE_LABEL[door.action]} ${formatTime(door.at)}`
    : door.phase === "error" ? door.message
    : "Stand by the door, then tap Open.";

  return (
    <Card style={styles.active}>
      <View style={styles.activeHead}>
        <Text style={styles.activeTitle} numberOfLines={2}>
          {g?.title ?? "Garage"}
        </Text>
        <View style={styles.leftBox}>
          <Text style={styles.leftFigure}>{formatDuration(left)}</Text>
          <Text style={styles.caption}>left, until {formatTime(new Date(booking.ends_at))}</Text>
        </View>
      </View>

      {app ? (
        <>
          <DoorPanel visual={visual} restingOpen={isOpen} caption={caption} />
          <Button
            title={door.phase === "busy" ? BUSY_LABEL[door.action] : door.phase === "error" ? "Try again" : next === "open" ? "Open" : "Close"}
            icon={next === "open" ? "lock-open" : "lock-closed"}
            // Yellow always means "open the door"; closing is the quiet light button
            variant={next === "open" ? "accent" : "primary"}
            loading={door.phase === "busy"}
            onPress={() => send(next)}
            style={styles.openBtn}
            accessibilityLabel={`${next === "open" ? "Open" : "Close"} the garage door`}
          />
        </>
      ) : (
        <View style={styles.manual}>
          <IconTile icon="key" size={40} bg={colors.surface} />
          <Text style={[styles.body, { flex: 1 }]}>The host lets you in for this garage. It doesn&apos;t open from the app.</Text>
        </View>
      )}

      <Text style={styles.paidLine}>
        Paid {formatCents(amountOf(booking))} with {paidWith(booking)}
      </Text>
    </Card>
  );
}

const BUSY_LABEL: Record<DoorAction, string> = { open: "Opening…", close: "Closing…" };
const DONE_LABEL: Record<DoorAction, string> = { open: "Opened", close: "Closed" };

const amountOf = (b: Booking) => b.amount_cents ?? Math.round(b.total_price * 100);

const paidWith = (b: Booking) =>
  b.payment?.method === "wallet"
    ? "Demo wallet"
    : b.payment?.card_last4
      ? `${b.payment.card_brand ?? "Card"} •••• ${b.payment.card_last4}`
      : "Card";

// Status chip for a booking row: Paid / Refunded / Cancelled / Expired / Not paid
function statusTag(b: Booking): { label: string; bg: string; color: string } {
  if (b.status === "paid") return { label: "Paid", bg: colors.successSoft, color: colors.success };
  if (b.status === "cancelled" && b.payment?.status === "refunded") return { label: "Refunded", bg: colors.accentSoft, color: colors.accentDeep };
  if (b.status === "cancelled") return { label: "Cancelled", bg: colors.sand, color: colors.textMuted };
  if (b.status === "expired") return { label: "Expired", bg: colors.sand, color: colors.textMuted };
  return { label: "Not paid", bg: colors.errorSoft, color: colors.errorText };
}

type RowProps = { booking: Booking; now: Date; note?: string; muted?: boolean; onChanged?: () => void };

function BookingRow({ booking, now, note, muted, onChanged }: RowProps) {
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
      notify(r.refund ? `Cancelled. Refunded ${formatCents(r.refunded_cents)}` : "Booking cancelled");
      onChanged?.();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  return (
    <Card style={[styles.rowCard, muted && { opacity: 0.7 }]}>
      <View style={styles.row}>
        <IconTile icon={g?.access === "app" ? "phone-portrait" : "key"} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {g?.title ?? "Garage"}
          </Text>
          <Text style={styles.caption}>{formatRange(booking.starts_at, booking.ends_at)}</Text>
          <View style={styles.tagRow}>
            <Tag label={tag.label} bg={tag.bg} color={tag.color} />
            {booking.payment && booking.status !== "pending_payment" && booking.status !== "expired" ? (
              <Text style={styles.caption}>{paidWith(booking)}</Text>
            ) : null}
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
        <Text style={[styles.price, booking.status === "cancelled" && styles.struck]}>{formatCents(amount)}</Text>
      </View>

      {canCancel ? (
        confirming ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.caption, { flex: 1 }]}>
              {booking.status === "paid" ? `Cancel and refund ${formatCents(amount)}?` : "Cancel and free this slot?"}
            </Text>
            <Button title="Keep" size="sm" variant="ghost" disabled={cancelling} onPress={() => setConfirming(false)} />
            <Button title="Cancel booking" size="sm" variant="danger" loading={cancelling} onPress={cancel} />
          </View>
        ) : (
          <Button title="Cancel booking" size="sm" variant="ghost" icon="close-circle" onPress={() => setConfirming(true)} style={styles.cancelBtn} />
        )
      ) : null}
    </Card>
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
  rowCard: { marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowTitle: { ...typography.h3, color: colors.ink },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginTop: 2 },
  note: { ...typography.label, color: colors.accentDeep },
  price: { ...typography.h3, color: colors.ink },
  struck: { textDecorationLine: "line-through", color: colors.textMuted },
  paidLine: { ...typography.label, color: colors.success },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  cancelBtn: { alignSelf: "flex-start" },
});
