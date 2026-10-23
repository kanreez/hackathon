import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Chip } from "../../components/Chip";
import { Header, IconButton } from "../../components/Header";
import { Input } from "../../components/Input";
import { ItemRow } from "../../components/ItemRow";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { CATEGORIES, Item } from "../../constants/mockData";
import { colors, spacing } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { listItems } from "../../services/items";
import { Coords, distanceKm, getCurrentLocation } from "../../utils/location";

type Category = Item["category"] | "all";

export default function Explore() {
  const params = useLocalSearchParams<{ near?: string }>();
  const { data, loading, refreshing, error, reload, refresh } = useAsync(listItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  useRefreshOnFocus(refresh);

  const toggleNearby = async () => {
    if (coords) return setCoords(null);
    try {
      setLocating(true);
      setCoords(await getCurrentLocation());
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLocating(false);
    }
  };

  // Opened from Home's "Nearby" button
  useEffect(() => {
    if (params.near === "1" && !coords) toggleNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.near]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (data ?? []).filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    );
    if (!coords) return filtered.map((item) => ({ item, km: undefined as number | undefined }));
    return filtered
      .map((item) => ({
        item,
        km:
          item.latitude != null && item.longitude != null
            ? distanceKm(coords, { latitude: item.latitude, longitude: item.longitude })
            : undefined,
      }))
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [data, query, category, coords]);

  const isFiltering = !!query.trim() || category !== "all";

  return (
    <ScreenWrapper>
      <Header
        title="Explore"
        subtitle={data ? `${results.length} of ${data.length} items` : undefined}
        right={<IconButton icon="add" label="Add item" tone="solid" onPress={() => router.push("/item/edit")} />}
      />

      <Input
        placeholder="Search by name or description"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={locating ? "Locating…" : "Nearby"}
          icon="locate"
          selected={!!coords}
          onPress={toggleNearby}
        />
        <View style={styles.divider} />
        <Chip label="All" selected={category === "all"} onPress={() => setCategory("all")} />
        {CATEGORIES.map((c) => (
          <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
        ))}
      </ScrollView>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.item.id}
          renderItem={({ item: r }) => (
            <ItemRow
              item={r.item}
              distanceKm={r.km}
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: r.item.id } })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />}
          ListEmptyComponent={
            isFiltering ? (
              <EmptyState
                icon="search-outline"
                title="No matches"
                body="Try a different word or another category."
                actionLabel="Clear filters"
                onAction={() => {
                  setQuery("");
                  setCategory("all");
                }}
              />
            ) : (
              <EmptyState
                title="Nothing here yet"
                body="Add the first item and it will show up here."
                actionLabel="Add item"
                onAction={() => router.push("/item/edit")}
              />
            )
          }
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  chipsScroll: { flexGrow: 0, marginTop: spacing.md, marginHorizontal: -spacing.lg },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },
  list: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
});
