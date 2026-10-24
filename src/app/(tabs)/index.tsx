import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SectionTitle, StickerHeadline, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { GarageRow } from "../../components/GarageRow";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { StepTracker } from "../../components/StepTracker";
import { notify } from "../../components/Toast";
import { EXAMPLE_QUERIES, SIZE_META } from "../../constants/garages";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { listGarages, searchGarages } from "../../services/garages";
import { Garage, SearchResult } from "../../types/garage";
import { formatRange } from "../../utils/booking";
import { Coords, distanceKm, getCurrentLocation } from "../../utils/location";

// Screen 1: ask in plain language, see matching garages nearby
export default function Find() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [me, setMe] = useState<Coords | null>(null);
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
  const others = result && all.data ? sortByDistance(all.data.filter((g) => !result.garages.some((m) => m.id === g.id))) : [];

  return (
    <ScreenWrapper scroll refreshing={all.refreshing} onRefresh={all.refresh}>
      <StepTracker active={0} />
      <Text style={styles.eyebrow}>Find a garage</Text>
      <StickerHeadline lead="Park it" sticker="nearby." />
      <Text style={styles.sub}>Say what you need. We find a garage that fits, and you open it from your phone.</Text>

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
              style={({ pressed }) => [styles.example, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.exampleText} numberOfLines={1}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Find garages"
          icon="sparkles"
          variant="accent"
          loading={searching}
          disabled={!query.trim()}
          onPress={() => search()}
        />
      </Card>

      {result ? <Understood result={result} onClear={() => setResult(null)} /> : null}

      <SectionTitle>{result ? (result.garages.length ? "Matches" : "No exact match") : "Garages near you"}</SectionTitle>
      {all.loading && !result ? (
        <Loading />
      ) : all.error && !result ? (
        <ErrorState message={all.error} onRetry={all.reload} />
      ) : !shown.length && !result ? (
        <EmptyState icon="car-outline" title="No garages yet" body="When hosts list garages they show up here." />
      ) : (
        shown.map(({ garage, km }) => <GarageRow key={garage.id} garage={garage} distanceKm={km} onPress={() => open(garage)} />)
      )}

      {result && others.length ? (
        <>
          <SectionTitle muted>{result.garages.length ? "Other garages" : "Closest alternatives"}</SectionTitle>
          {others.map(({ garage, km }) => (
            <GarageRow key={garage.id} garage={garage} distanceKm={km} onPress={() => open(garage)} />
          ))}
        </>
      ) : null}
    </ScreenWrapper>
  );
}

// Shows what the AI took from the request, so the renter can trust (or fix) the search
function Understood({ result, onClear }: { result: SearchResult; onClear: () => void }) {
  const f = result.filters;
  const chips = [
    f.area ? { icon: "location" as const, label: f.area } : null,
    result.from_utc && result.to_utc ? { icon: "time" as const, label: formatRange(result.from_utc, result.to_utc) } : null,
    f.vehicle_size ? { icon: "car" as const, label: `Fits ${SIZE_META[f.vehicle_size].hint}` } : null,
    f.covered === true ? { icon: "umbrella" as const, label: "Covered" } : null,
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
            <Tag key={c.label} label={c.label} icon={c.icon} bg={colors.surface} />
          ))}
        </View>
      ) : (
        <Text style={styles.caption}>No filters found. Try naming an area, a time or your car.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.eyebrow, color: colors.accentDeep, marginBottom: spacing.sm },
  eyebrowMuted: { ...typography.eyebrow, color: colors.textMuted },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.lg },
  ask: { gap: spacing.md, padding: spacing.md },
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
  understood: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  understoodHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clear: { ...typography.label, color: colors.accentDeep, textDecorationLine: "underline" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  caption: { ...typography.caption, color: colors.textMuted },
});
