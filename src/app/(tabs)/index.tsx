import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Headline, SectionTitle } from "../../components/Bits";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Chip } from "../../components/Chip";
import { GarageRow } from "../../components/GarageRow";
import { IconButton } from "../../components/Header";
import { Input } from "../../components/Input";
import { AppMap } from "../../components/map/AppMap";
import { MapPin } from "../../components/map/types";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { StepTracker } from "../../components/StepTracker";
import { notify } from "../../components/Toast";
import { AREA_CENTERS, EXAMPLE_QUERIES, SIZE_META } from "../../constants/garages";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useIsWide } from "../../hooks/useIsWide";
import { listGarages, searchGarages } from "../../services/garages";
import { Garage, SearchResult } from "../../types/garage";
import { formatMoney, formatRange } from "../../utils/booking";
import { Coords, distanceKm, getCurrentLocation } from "../../utils/location";

// Screen 1: ask in plain language, see matching garages nearby
export default function Find() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [me, setMe] = useState<Coords | null>(null);
  const wide = useIsWide();
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = useAsync(listGarages);

  // Location is optional: without it the list keeps the server's order
  useEffect(() => {
    getCurrentLocation().then(setMe).catch(() => {});
  }, []);

  const search = async (text = query) => {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    try {
      setSearching(true);
      setResult(await searchGarages(q));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSearching(false);
    }
  };

  // Distance from the area the renter asked about, else from where they are
  const origin = result?.center ?? me;
  const sortByDistance = (list: Garage[]) =>
    list
      .map((g) => ({
        garage: g,
        km: origin && g.latitude != null && g.longitude != null ? distanceKm(origin, { latitude: g.latitude, longitude: g.longitude }) : null,
      }))
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  const open = (g: Garage) =>
    router.push({
      pathname: "/garage/[id]",
      params: { id: g.id, ...(result?.from_utc && result.to_utc ? { from: result.from_utc, to: result.to_utc } : {}) },
    });

  const shown = result ? sortByDistance(result.garages) : sortByDistance(all.data ?? []);

  // Map view: the same garages as the list, as price pins
  const pins: MapPin[] = shown.flatMap(({ garage: g }) =>
    g.latitude != null && g.longitude != null
      ? [{ id: g.id, latitude: g.latitude, longitude: g.longitude, label: `${formatMoney(g.price_hour)}/h` }]
      : []
  );
  const selected = shown.find((s) => s.garage.id === selectedId) ?? null;
  // The searched area, else the middle of the pins (your own location may be far from any garage)
  const mapCenter: Coords =
    result?.center ??
    (pins.length
      ? {
          latitude: pins.reduce((sum, p) => sum + p.latitude, 0) / pins.length,
          longitude: pins.reduce((sum, p) => sum + p.longitude, 0) / pins.length,
        }
      : me ?? AREA_CENTERS.Lagera);
  const others = result && all.data ? sortByDistance(all.data.filter((g) => !result.garages.some((m) => m.id === g.id))) : [];

  const ask = (
    <>
      {wide ? null : (
        <View style={styles.topRow}>
          <BrandMark />
          <IconButton icon="time-outline" label="My bookings" onPress={() => router.navigate("/bookings")} />
        </View>
      )}
      <Headline title="Need a garage nearby?" subline="Say what you need. We find one that fits, and you open it from your phone." />

      <Card style={styles.ask}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="garage near Pirogov tomorrow 9 to 13, fits a Golf"
          multiline
          maxLength={300}
          accessibilityLabel="Describe the garage you need"
          style={{ minHeight: 84 }}
        />
        <View style={styles.examples}>
          {EXAMPLE_QUERIES.map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              accessibilityLabel={`Try: ${q}`}
              onPress={() => search(q)}
              style={({ pressed }) => [styles.example, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Text style={styles.exampleText} numberOfLines={1}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Find garages"
          icon="search"
          variant="accent"
          loading={searching}
          disabled={!query.trim()}
          onPress={() => search()}
        />
      </Card>

      {result ? <Understood result={result} onClear={() => setResult(null)} /> : null}
    </>
  );

  const results = (
    <>
      <View style={styles.resultsHead}>
        <SectionTitle>{result ? (result.garages.length ? "Matches" : "No exact match") : "Garages near you"}</SectionTitle>
        {shown.length ? (
          <View style={styles.viewToggle}>
            <Chip label="List" icon="list" selected={view === "list"} onPress={() => setView("list")} />
            <Chip label="Map" icon="map" selected={view === "map"} onPress={() => setView("map")} />
          </View>
        ) : null}
      </View>
      {view === "map" && shown.length ? (
        <>
          <AppMap
            center={mapCenter}
            zoom={14}
            pins={pins}
            fitToPins
            selectedId={selected?.garage.id}
            onSelectPin={setSelectedId}
            style={{ height: wide ? 480 : 340 }}
          />
          {selected ? (
            <View style={{ marginTop: spacing.md }}>
              <GarageRow garage={selected.garage} distanceKm={selected.km} onPress={() => open(selected.garage)} />
            </View>
          ) : (
            <Text style={styles.mapHint}>Tap a price on the map to see that garage.</Text>
          )}
          {shown.length > pins.length ? (
            <Text style={styles.mapHint}>
              {shown.length - pins.length} more without a map location. Switch to List to see them.
            </Text>
          ) : null}
        </>
      ) : all.loading && !result ? (
        <Loading />
      ) : all.error && !result ? (
        <ErrorState message={all.error} onRetry={all.reload} />
      ) : !shown.length && !result ? (
        <EmptyState icon="car-outline" title="No garages yet" body="When hosts list garages they show up here." />
      ) : (
        shown.map(({ garage, km }) => <GarageRow key={garage.id} garage={garage} distanceKm={km} onPress={() => open(garage)} />)
      )}

      {view === "list" && result && others.length ? (
        <>
          <SectionTitle muted>{result.garages.length ? "Other garages" : "Closest alternatives"}</SectionTitle>
          {others.map(({ garage, km }) => (
            <GarageRow key={garage.id} garage={garage} distanceKm={km} onPress={() => open(garage)} />
          ))}
        </>
      ) : null}
    </>
  );

  return (
    <ScreenWrapper scroll refreshing={all.refreshing} onRefresh={all.refresh}>
      <StepTracker active={0} />
      {wide ? (
        // PC: the ask panel stays in view on the left while the results scroll on the right
        <View style={styles.columns}>
          <View style={[styles.askColumn, stickyOnWeb]}>{ask}</View>
          <View style={styles.resultsColumn}>{results}</View>
        </View>
      ) : (
        <>
          {ask}
          {results}
        </>
      )}
    </ScreenWrapper>
  );
}

// position: sticky only exists on web; react-native-web passes it through
const stickyOnWeb = (Platform.OS === "web" ? { position: "sticky", top: spacing.lg } : null) as ViewStyle | null;

// One understood filter, set like a Bulgarian number plate: white strip, blue band on the left
function Plate({ label }: { label: string }) {
  return (
    <View style={styles.plate}>
      <View style={styles.plateBand} />
      <Text style={styles.plateText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Shows what the AI took from the request, so the renter can trust (or fix) the search
function Understood({ result, onClear }: { result: SearchResult; onClear: () => void }) {
  const f = result.filters;
  const chips = [
    f.area ? { label: f.area } : null,
    result.from_utc && result.to_utc ? { label: formatRange(result.from_utc, result.to_utc) } : null,
    f.vehicle_size ? { label: `Fits ${SIZE_META[f.vehicle_size].fits}` } : null,
    f.covered === true ? { label: "Covered" } : null,
  ].filter((c) => c !== null);

  return (
    <View style={styles.understood}>
      <View style={styles.understoodHead}>
        <Text style={styles.eyebrowMuted}>What I understood</Text>
        <Pressable accessibilityRole="button" onPress={onClear} hitSlop={12}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>
      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <Plate key={c.label} label={c.label} />
          ))}
        </View>
      ) : (
        <Text style={styles.caption}>No filters found. Try naming an area, a time or your car.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrowMuted: { ...typography.eyebrow, color: colors.textMuted },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  ask: { gap: spacing.md, padding: spacing.md, marginTop: spacing.lg, borderRadius: radius.xl },
  examples: { gap: 6 },
  example: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
  },
  exampleText: { ...typography.caption, color: colors.ink },
  understood: { marginTop: spacing.lg, gap: spacing.sm },
  understoodHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clear: { ...typography.label, color: colors.accentDeep, textDecorationLine: "underline" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  plate: {
    flexDirection: "row",
    alignItems: "stretch",
    maxWidth: "100%",
    minHeight: 32,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.plate,
  },
  plateBand: { width: 10, backgroundColor: colors.accent },
  plateText: { ...typography.label, color: colors.onInk, paddingHorizontal: 10, alignSelf: "center", flexShrink: 1, ...typography.tabular },
  caption: { ...typography.caption, color: colors.textMuted },
  resultsHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md },
  viewToggle: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  mapHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  askColumn: { width: 420 },
  // The first SectionTitle's top margin would push the list below the ask panel's top edge
  resultsColumn: { flex: 1, minWidth: 0, marginTop: -spacing.xl },
});
