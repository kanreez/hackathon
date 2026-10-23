import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { IconButton } from "../../components/Header";
import { formatPrice } from "../../components/ItemRow";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { CATEGORIES } from "../../constants/mockData";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { deleteItem, getItem } from "../../services/items";
import { askAI } from "../../utils/ai";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: item, loading, error, reload, refresh } = useAsync(() => getItem(id), [id]);
  useRefreshOnFocus(refresh); // pick up changes after editing

  const [tips, setTips] = useState("");
  const [tipsLoading, setTipsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return (
      <ScreenWrapper>
        <Loading />
      </ScreenWrapper>
    );
  }
  if (error || !item) {
    return (
      <ScreenWrapper>
        <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <EmptyState icon="help-circle-outline" title="Item not found" body="It may have been deleted." />
        )}
      </ScreenWrapper>
    );
  }

  const categoryLabel = CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category;
  const hasLocation = item.latitude != null && item.longitude != null;

  const getTips = async () => {
    try {
      setTipsLoading(true);
      setTips(
        await askAI(`Give 3 short, practical tips for someone interested in "${item.title}". Context: ${item.description}`, {
          system: "You are a friendly local guide. Answer in plain text, one tip per line, no markdown.",
        })
      );
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setTipsLoading(false);
    }
  };

  // Two taps instead of a confirm dialog, because Alert dialogs don't work on web
  const onDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    try {
      setDeleting(true);
      await deleteItem(item.id);
      notify("Item deleted");
      router.back();
    } catch (e: any) {
      notify(e.message, "error");
      setDeleting(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View>
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />
          <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
            <IconButton
              icon="create-outline"
              label="Edit item"
              onPress={() => router.push({ pathname: "/item/edit", params: { id: item.id } })}
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.metaRow}>
            <Chip label={categoryLabel} />
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
          <Text style={styles.description}>{item.description}</Text>

          {hasLocation ? (
            <Button
              title="Open in maps"
              icon="map-outline"
              variant="secondary"
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`)
              }
            />
          ) : null}

          <View style={styles.aiBox}>
            <Text style={styles.aiTitle}>Tips from the assistant</Text>
            {tips ? (
              <Text style={styles.aiText}>{tips}</Text>
            ) : (
              <Text style={styles.aiHint}>Get three quick tips about this item.</Text>
            )}
            <Button
              title={tips ? "Get new tips" : "Get tips"}
              icon="sparkles"
              size="sm"
              loading={tipsLoading}
              onPress={getTips}
              style={{ alignSelf: "flex-start" }}
            />
          </View>

          <Button
            title={confirmDelete ? "Tap again to delete" : "Delete item"}
            icon="trash-outline"
            variant="danger"
            loading={deleting}
            onPress={onDelete}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  image: { width: "100%", height: 320, backgroundColor: colors.secondary },
  topBar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { ...typography.label, color: colors.ink },
  title: { ...typography.display, color: colors.ink },
  price: { ...typography.h2, color: colors.ink, marginTop: -spacing.sm },
  description: { ...typography.body, color: colors.textMuted },
  aiBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  aiTitle: { ...typography.h3, color: colors.ink },
  aiText: { ...typography.body, color: colors.ink },
  aiHint: { ...typography.body, color: colors.textMuted },
});
