import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { formatPrice, ItemRow } from "../../components/ItemRow";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { listItems } from "../../services/items";

export default function Home() {
  const { user } = useAuth();
  const { data: items, loading, refreshing, error, reload, refresh } = useAsync(listItems);
  const [question, setQuestion] = useState("");

  // Reload when coming back to this tab (e.g. after adding an item)
  useRefreshOnFocus(refresh);

  const fullName: string = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    router.push({ pathname: "/ai", params: { q } });
  };

  const recent = (items ?? []).slice(0, 6);
  const topRated = [...(items ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {firstName}</Text>
          <Text style={styles.sub}>What are we working on today?</Text>
        </View>
        <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/profile")}>
          <Avatar name={fullName} uri={user?.user_metadata?.avatar_url} />
        </Pressable>
      </View>

      {/* The one loud element on the screen */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Ask the assistant</Text>
        <Text style={styles.heroBody}>Ideas, answers, plans and summaries in a few seconds.</Text>
        <View style={styles.askRow}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={ask}
            placeholder="Type a question"
            placeholderTextColor={colors.textMuted}
            returnKeyType="send"
            style={styles.askInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question"
            onPress={ask}
            style={({ pressed }) => [styles.askBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionsScroll}
        contentContainerStyle={styles.actions}
      >
        <Button title="Add item" icon="add" size="sm" onPress={() => router.push("/item/edit")} />
        <Button
          title="Nearby"
          icon="locate"
          size="sm"
          variant="secondary"
          onPress={() => router.push({ pathname: "/explore", params: { near: "1" } })}
        />
        <Button title="Browse all" icon="compass" size="sm" variant="secondary" onPress={() => router.push("/explore")} />
      </ScrollView>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <Text style={styles.section}>Recently added</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
            {recent.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
              >
                <Image source={{ uri: item.image }} style={styles.tileImage} contentFit="cover" transition={150} />
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.tileMeta}>{formatPrice(item.price)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>Top rated</Text>
          <View style={styles.list}>
            {topRated.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              />
            ))}
          </View>
        </>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  hello: { ...typography.display, color: colors.ink },
  sub: { ...typography.body, color: colors.textMuted, marginTop: 2 },

  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: { ...typography.h1, color: colors.ink },
  heroBody: { ...typography.body, color: colors.ink, opacity: 0.8, maxWidth: 320 },
  askRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    padding: 6,
    marginTop: spacing.sm,
  },
  askInput: { ...typography.body, flex: 1, color: colors.ink, paddingVertical: 8, minWidth: 0 },
  askBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },

  actionsScroll: { flexGrow: 0, marginTop: spacing.md, marginHorizontal: -spacing.lg },
  actions: { gap: spacing.sm, paddingHorizontal: spacing.lg },

  section: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.md },
  tiles: { gap: spacing.md, paddingRight: spacing.lg },
  tile: { width: 150, gap: 6 },
  tileImage: { width: 150, height: 150, borderRadius: radius.lg, backgroundColor: colors.secondary },
  tileTitle: { ...typography.label, color: colors.ink },
  tileMeta: { ...typography.caption, color: colors.textMuted, marginTop: -4 },
  list: { gap: spacing.sm },
});
