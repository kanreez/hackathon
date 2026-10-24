import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconTile, SectionTitle, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { getCommand, myBookings, openGarage } from "../../services/garages";
import { Booking } from "../../types/garage";
import { formatDuration, formatMoney, formatRange, formatTime } from "../../utils/booking";

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

  const bookings = data ?? [];
  const active = bookings.filter((b) => new Date(b.starts_at) <= now && new Date(b.ends_at) > now);
  const upcoming = bookings
    .filter((b) => new Date(b.starts_at) > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const past = bookings.filter((b) => new Date(b.ends_at) <= now);

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh}>
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
                <BookingRow key={b.id} booking={b} note={`Starts in ${formatDuration(new Date(b.starts_at).getTime() - now.getTime())}`} />
              ))}
            </>
          ) : null}

          {past.length ? (
            <>
              <SectionTitle muted>Past</SectionTitle>
              {past.map((b) => (
                <BookingRow key={b.id} booking={b} muted />
              ))}
            </>
          ) : null}
        </>
      )}
    </ScreenWrapper>
  );
}

type Door = { phase: "idle" } | { phase: "opening" } | { phase: "opened"; at: Date } | { phase: "error"; message: string };

function ActiveBooking({ booking, now }: { booking: Booking; now: Date }) {
  const g = booking.garage;
  const [door, setDoor] = useState<Door>({ phase: "idle" });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; // stop polling when the screen goes away
    };
  }, []);

  const open = async () => {
    if (!g) return;
    setDoor({ phase: "opening" });
    try {
      const commandId = await openGarage(g.id);
      const startedAt = Date.now();
      while (alive.current && Date.now() - startedAt < GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const c = await getCommand(commandId);
        if (c.status === "opened") {
          const at = c.acked_at ? new Date(c.acked_at) : new Date();
          setDoor({ phase: "opened", at });
          notify(`Opened ${formatTime(at)}`);
          return;
        }
        if (c.status === "error") throw new Error(c.error ?? "The door couldn't be opened");
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

  return (
    <Card style={styles.active}>
      <View style={styles.activeHead}>
        <Tag label="Active now" icon="radio-button-on" bg={colors.successSoft} color={colors.success} />
        <Text style={styles.caption}>{formatDuration(left)} left</Text>
      </View>
      <Text style={styles.activeTitle}>{g?.title ?? "Garage"}</Text>
      <Text style={styles.caption}>
        {[g?.area, g?.address].filter(Boolean).join(" · ")} · until {formatTime(new Date(booking.ends_at))}
      </Text>

      {app ? (
        <>
          <DoorStatus door={door} />
          <Button
            title={door.phase === "opening" ? "Opening…" : door.phase === "opened" ? "Open again" : "Open garage"}
            icon="lock-open"
            variant="accent"
            loading={door.phase === "opening"}
            onPress={open}
            style={styles.openBtn}
            accessibilityLabel="Open the garage door"
          />
        </>
      ) : (
        <View style={styles.manual}>
          <IconTile icon="key" size={40} bg={colors.surface} />
          <Text style={[styles.body, { flex: 1 }]}>The host lets you in for this garage. It doesn&apos;t open from the app.</Text>
        </View>
      )}
    </Card>
  );
}

function DoorStatus({ door }: { door: Door }) {
  if (door.phase === "idle") return <Text style={styles.hint}>Stand by the door, then tap Open. It opens in a second or two.</Text>;
  if (door.phase === "opening") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <IconTile icon="hourglass" size={40} bg={colors.accentSoft} color={colors.accentDeep} />
        <Text style={styles.statusText}>Opening… waiting for the door</Text>
      </View>
    );
  }
  if (door.phase === "opened") {
    return (
      <View style={[styles.status, { backgroundColor: colors.successSoft }]} accessibilityLiveRegion="polite">
        <IconTile icon="checkmark" size={40} bg={colors.surface} color={colors.success} />
        <Text style={[styles.statusText, { color: colors.success }]}>Opened {formatTime(door.at)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.status, { backgroundColor: colors.errorSoft }]} accessibilityRole="alert">
      <IconTile icon="alert-circle" size={40} bg={colors.surface} color={colors.error} />
      <Text style={[styles.statusText, { color: colors.error }]}>{door.message}</Text>
    </View>
  );
}

function BookingRow({ booking, note, muted }: { booking: Booking; note?: string; muted?: boolean }) {
  const g = booking.garage;
  return (
    <Card style={[styles.row, muted && { opacity: 0.7 }]}>
      <IconTile icon={g?.access === "app" ? "phone-portrait" : "key"} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {g?.title ?? "Garage"}
        </Text>
        <Text style={styles.caption}>{formatRange(booking.starts_at, booking.ends_at)}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={styles.price}>{formatMoney(booking.total_price)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  active: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.xl },
  activeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeTitle: { ...typography.h1, color: colors.ink, marginTop: spacing.xs },
  caption: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.ink },
  hint: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  statusText: { ...typography.h3, color: colors.ink, flex: 1 },
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowTitle: { ...typography.h3, color: colors.ink },
  note: { ...typography.label, color: colors.accentDeep },
  price: { ...typography.h3, color: colors.ink },
});
