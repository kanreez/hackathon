import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconTile, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { GarageRow } from "../../components/GarageRow";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { t, tn, useT } from "../../i18n";
import { deleteGarage, myGarages, setGarageHidden } from "../../services/garages";
import { hostEarnings } from "../../services/payments";
import { Earnings, Garage } from "../../types/garage";
import { summarizeAvailability } from "../../utils/availability";
import { formatCents, formatDuration } from "../../utils/booking";

const ONLINE_MS = 10000; // the ESP32 polls every second, so 10 s of silence means it's offline
const PLATFORM_FEE_RATE = 0.15; // same as server/payments/pricing.js; display only

// Host side: your listed garages, and the device key to flash onto each garage's ESP32
export default function HostGarages() {
  useT(); // re-render in a new language
  const { data, loading, refreshing, error, reload, refresh, setData } = useAsync(myGarages);
  const earnings = useAsync(hostEarnings);

  useRefreshOnFocus(refresh);
  useRefreshOnFocus(earnings.refresh);

  // Refresh "device online" while the host is pairing
  useEffect(() => {
    const t = setInterval(() => {
      myGarages().then(setData).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [setData]);

  const garages = data ?? [];

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh} style={styles.page}>
      <Header eyebrow={t("host.eyebrow")} title={t("profile.garages")} subtitle={t("host.subtitle")} back backTo="/profile" />
      {garages.length && earnings.data ? <EarningsCard earnings={earnings.data} /> : null}
      <Button title={t("host.list")} icon="add" variant="accent" onPress={() => router.push("/host/new")} />
      <View style={{ height: spacing.lg }} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !garages.length ? (
        <EmptyState icon="home-outline" title={t("host.emptyTitle")} body={t("host.emptyBody")} />
      ) : (
        garages.map((g) => (
          <View key={g.id} style={{ marginBottom: spacing.md }}>
            <GarageRow garage={g} onPress={() => router.push({ pathname: "/host/new", params: { id: g.id } })} />
            <Text style={styles.free}>{t("host.free", { hours: summarizeAvailability(g.availability) })}</Text>
            <ListingActions
              garage={g}
              onChanged={(next) => setData(garages.map((x) => (x.id === next.id ? { ...x, ...next } : x)))}
              onDeleted={() => setData(garages.filter((x) => x.id !== g.id))}
            />
            {g.access === "app" ? <PairDevice garage={g} /> : null}
          </View>
        ))
      )}
    </ScreenWrapper>
  );
}

// Hide takes the garage off search (bookings already made keep working); Delete is for good,
// after a confirm. The server refuses Delete while bookings haven't ended.
function ListingActions({ garage, onChanged, onDeleted }: { garage: Garage; onChanged: (g: Garage) => void; onDeleted: () => void }) {
  useT();
  const [busy, setBusy] = useState<"hide" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const hidden = !!garage.hidden;

  const toggle = async () => {
    try {
      setBusy("hide");
      onChanged(await setGarageHidden(garage.id, !hidden));
      notify(t(hidden ? "host.shownDone" : "host.hiddenDone", { title: garage.title }));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    try {
      setBusy("delete");
      await deleteGarage(garage.id);
      notify(t("host.deletedDone", { title: garage.title }));
      onDeleted();
    } catch (e: any) {
      notify(e.message, "error");
      setBusy(null);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <Card style={styles.confirm}>
        <Text style={styles.body}>{t("host.deleteConfirm", { title: garage.title })}</Text>
        <View style={styles.actions}>
          <Button title={t("host.keep")} size="sm" variant="ghost" disabled={busy === "delete"} onPress={() => setConfirming(false)} />
          <Button title={t("host.deleteYes")} size="sm" variant="danger" icon="trash" loading={busy === "delete"} onPress={remove} />
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.listing}>
      {hidden ? (
        <View style={styles.hiddenRow}>
          <Tag label={t("host.hiddenTag")} icon="eye-off" bg={colors.sand} />
          <Text style={[styles.caption, { flex: 1 }]}>{t("host.hiddenNote")}</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          title={hidden ? t("host.show") : t("host.hide")}
          icon={hidden ? "eye" : "eye-off"}
          size="sm"
          variant="secondary"
          loading={busy === "hide"}
          onPress={toggle}
        />
        <Button title={t("host.delete")} icon="trash-outline" size="sm" variant="ghost" disabled={!!busy} onPress={() => setConfirming(true)} />
      </View>
    </View>
  );
}

// What the host has earned: paid bookings after the platform fee, refunds excluded
function EarningsCard({ earnings }: { earnings: Earnings }) {
  useT();
  const count = earnings.bookings.length;
  return (
    <Card style={styles.earnings}>
      <IconTile icon="cash" size={44} bg={colors.successSoft} color={colors.success} />
      <View style={{ flex: 1 }}>
        <Text style={styles.caption}>{t("host.earnings")}</Text>
        <Text style={styles.earningsValue}>{formatCents(earnings.total_payout_cents)}</Text>
      </View>
      <Text style={styles.caption}>
        {tn("host.paidBookings", count)}
        {"\n"}
        {t("host.afterFee", { pct: Math.round(PLATFORM_FEE_RATE * 100) })}
      </Text>
    </Card>
  );
}

// "Pair a device": the key to flash onto the ESP32, and whether it has checked in
function PairDevice({ garage }: { garage: Garage }) {
  useT();
  const seen = garage.device_last_seen ? Date.now() - new Date(garage.device_last_seen).getTime() : null;
  const online = seen != null && seen < ONLINE_MS;
  return (
    <Card style={styles.pair}>
      <View style={styles.pairHead}>
        <IconTile icon="hardware-chip" size={40} />
        <Text style={styles.pairTitle}>{t("host.pair")}</Text>
        {online ? (
          <Tag label={t("host.online")} icon="radio-button-on" bg={colors.successSoft} color={colors.success} />
        ) : (
          <Tag label={seen != null ? t("host.seenAgo", { time: formatDuration(seen) }) : t("host.notPaired")} bg={colors.sand} />
        )}
      </View>
      <Text style={styles.caption}>{t("host.flash")}</Text>
      <View style={styles.keyBox}>
        <Text selectable style={styles.key} accessibilityLabel={t("host.deviceKey")}>
          {garage.device_key}
        </Text>
      </View>
      <Text style={styles.caption}>{t("host.copy")}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 760, width: "100%", alignSelf: "center" },
  earnings: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  earningsValue: { ...typography.h1, color: colors.ink },
  pair: { gap: spacing.sm, marginTop: -spacing.xs, backgroundColor: colors.sand },
  pairHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pairTitle: { ...typography.h3, color: colors.ink, flex: 1 },
  caption: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.ink },
  listing: { gap: spacing.sm, marginBottom: spacing.sm },
  hiddenRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "flex-end" },
  confirm: { gap: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.errorSoft },
  free: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  keyBox: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  key: { ...typography.label, color: colors.ink, letterSpacing: 0.5 },
});
