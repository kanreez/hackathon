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
import { myGarages } from "../../services/garages";
import { Garage } from "../../types/garage";
import { summarizeAvailability } from "../../utils/availability";
import { formatDuration } from "../../utils/booking";

const ONLINE_MS = 10000; // the ESP32 polls every second, so 10 s of silence means it's offline

// Host side: your listed garages, and the device key to flash onto each garage's ESP32
export default function HostGarages() {
  const { data, loading, refreshing, error, reload, refresh, setData } = useAsync(myGarages);

  useRefreshOnFocus(refresh);

  // Refresh "device online" while the host is pairing
  useEffect(() => {
    const t = setInterval(() => {
      myGarages().then(setData).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [setData]);

  const garages = data ?? [];

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh}>
      <Header eyebrow="Host" title="Your garages" subtitle="Rent out your garage while you don't need it." back backTo="/profile" />
      <Button title="List a garage" icon="add" variant="accent" onPress={() => router.push("/host/new")} />
      <View style={{ height: spacing.lg }} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !garages.length ? (
        <EmptyState icon="home-outline" title="Nothing listed yet" body="List your garage with its size, price and how renters get in." />
      ) : (
        garages.map((g) => (
          <View key={g.id} style={{ marginBottom: spacing.md }}>
            <GarageRow garage={g} onPress={() => router.push({ pathname: "/host/new", params: { id: g.id } })} />
            <Text style={styles.free}>Free: {summarizeAvailability(g.availability)} · tap to edit</Text>
            {g.access === "app" ? <PairDevice garage={g} /> : null}
          </View>
        ))
      )}
    </ScreenWrapper>
  );
}

// "Pair a device": the key to flash onto the ESP32, and whether it has checked in
function PairDevice({ garage }: { garage: Garage }) {
  const seen = garage.device_last_seen ? Date.now() - new Date(garage.device_last_seen).getTime() : null;
  const online = seen != null && seen < ONLINE_MS;
  return (
    <Card style={styles.pair}>
      <View style={styles.pairHead}>
        <IconTile icon="hardware-chip" size={40} />
        <Text style={styles.pairTitle}>Pair a device</Text>
        {online ? (
          <Tag label="Online" icon="radio-button-on" bg={colors.successSoft} color={colors.success} />
        ) : (
          <Tag label={seen != null ? `Seen ${formatDuration(seen)} ago` : "Not paired"} bg={colors.sand} />
        )}
      </View>
      <Text style={styles.caption}>Flash the ESP32 for this garage with its device key. Keep it secret: it opens this door.</Text>
      <View style={styles.keyBox}>
        <Text selectable style={styles.key} accessibilityLabel="Device key">
          {garage.device_key}
        </Text>
      </View>
      <Text style={styles.caption}>Long-press (or select on web) to copy.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  pair: { gap: spacing.sm, marginTop: -spacing.xs, backgroundColor: colors.sand },
  pairHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pairTitle: { ...typography.h3, color: colors.ink, flex: 1 },
  caption: { ...typography.caption, color: colors.textMuted },
  free: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  keyBox: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  key: { ...typography.label, color: colors.ink, letterSpacing: 0.5 },
});
