import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BIG_CITIES, CITIES, City, cityLabel } from "../constants/garages";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";
import { useIsWide } from "../hooks/useIsWide";
import { getLang, useT } from "../i18n";
import { Input } from "./Input";

type Props = {
  label: string;
  value: string; // a CITIES name
  onChange: (name: string) => void;
};

// The four big cities first, the rest alphabetically in the app language
function ordered(): City[] {
  const lang = getLang();
  const shown = (c: City) => (lang === "bg" ? c.bg : c.name);
  const big = BIG_CITIES.map((n) => CITIES.find((c) => c.name === n)!);
  const rest = CITIES.filter((c) => !BIG_CITIES.includes(c.name)).sort((a, b) => shown(a).localeCompare(shown(b), lang));
  return [...big, ...rest];
}

// A field showing the chosen city; tapping it opens a list with a search box. Typing matches the
// English and the Bulgarian names.
export function CityPicker({ label, value, onChange }: Props) {
  const { t } = useT();
  const wide = useIsWide();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const cities = ordered().filter((c) => !q || c.name.toLowerCase().includes(q) || c.bg.toLowerCase().includes(q));

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (name: string) => {
    onChange(name);
    close();
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${cityLabel(value)}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.value}>{cityLabel(value)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType={wide ? "fade" : "slide"} onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.backdrop, wide && styles.backdropWide]}>
          {/* Tapping outside the sheet closes it */}
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("common.close")} />
          <View style={[styles.sheet, wide && styles.sheetWide]}>
            <View style={styles.head}>
              <Text style={styles.title}>{t("city.title")}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} hitSlop={8} style={styles.close}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            <Input placeholder={t("city.search")} value={query} onChangeText={setQuery} autoCorrect={false} autoFocus={wide} />
            <FlatList
              data={cities}
              keyExtractor={(c) => c.name}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const selected = item.name === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => pick(item.name)}
                    style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={[styles.rowText, selected && { color: colors.accentDeep }]}>{cityLabel(item.name)}</Text>
                    {selected ? <Ionicons name="checkmark" size={20} color={colors.accentDeep} /> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>{t("city.none")}</Text>}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.ink },
  // Looks like Input's box
  field: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.sand,
  },
  value: { ...typography.body, color: colors.ink },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.6)" },
  backdropWide: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  sheet: {
    height: "80%",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.float,
  },
  sheetWide: { width: "100%", maxWidth: 440, height: 560, borderRadius: radius.xl },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.h2, color: colors.ink },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  list: { flex: 1 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.accentSoft },
  rowText: { ...typography.body, color: colors.ink },
  empty: { ...typography.body, color: colors.textMuted, padding: spacing.md },
});
