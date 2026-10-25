import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconTile, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { GarageRow } from "../../components/GarageRow";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { t, tn, useT } from "../../i18n";
import { myGarages } from "../../services/garages";
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
            {g.access === "app" ? <PairDevice garage={g} /> : null}
          </View>
        ))
      )}
    </ScreenWrapper>
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
  free: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  keyBox: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  key: { ...typography.label, color: colors.ink, letterSpacing: 0.5 },
});
