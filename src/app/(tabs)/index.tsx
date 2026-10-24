import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../components/Button";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { SAMPLE_RESULT } from "../../constants/sampleResult";
import { useRole } from "../../context/RoleContext";
import { resetFlow, setFlow, useFlow } from "../../state/reportFlow";
import { Scope } from "../../types/triage";
import { pickImage, takePhoto } from "../../utils/media";

type IconName = ComponentProps<typeof Ionicons>["name"];

const WHERE: { value: Scope; label: string; hint: string; icon: IconName }[] = [
  { value: "own", label: "My flat", hint: "Inside my home", icon: "home" },
  { value: "common", label: "Building", hint: "Stairwell, roof, basement", icon: "business" },
  { value: "from_above", label: "From above", hint: "Water from the flat over me", icon: "water" },
];

// Screen 1: photo + where is the problem
export default function Capture() {
  const { photo, scope, note } = useFlow();
  const { role } = useRole();

  const capture = async (source: "camera" | "library") => {
    try {
      const options = { base64: true, quality: 0.5 };
      const img = source === "camera" ? await takePhoto(options) : await pickImage(options);
      if (img) setFlow({ photo: img });
    } catch (e: any) {
      notify(e?.message ?? "Could not get the photo", "error");
    }
  };

  const analyze = () => {
    setFlow({ result: null });
    router.push("/processing");
  };

  // Hard-coded response: demo path that needs no AI or internet
  const trySample = () => {
    setFlow({ result: SAMPLE_RESULT, scope: "own" });
    router.push("/result");
  };

  // The first tab is the resident's; the домоуправител starts in the inbox
  if (role === "manager") return <Redirect href="/inbox" />;

  return (
    <ScreenWrapper scroll>
      <Text style={styles.title}>Something broke?</Text>
      <Text style={styles.sub}>Take a photo. We tell you who should fix it, and what to do right now.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photo ? "Retake photo" : "Take a photo"}
        onPress={() => capture("camera")}
        style={({ pressed }) => [styles.photoBox, pressed && { opacity: 0.85 }]}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <>
            <Ionicons name="camera" size={40} color={colors.ink} />
            <Text style={styles.photoText}>Tap to photograph the problem</Text>
          </>
        )}
      </Pressable>
      <View style={styles.photoActions}>
        <Button title="Choose from gallery" icon="images" size="sm" variant="secondary" onPress={() => capture("library")} />
        {photo ? <Button title="Clear" size="sm" variant="ghost" onPress={resetFlow} /> : null}
      </View>

      <Text style={styles.section}>Where is it?</Text>
      <View style={styles.where}>
        {WHERE.map((w) => {
          const selected = w.value === scope;
          return (
            <Pressable
              key={w.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFlow({ scope: w.value })}
              style={[styles.whereCard, selected && styles.whereSelected]}
            >
              <Ionicons name={w.icon} size={22} color={selected ? colors.white : colors.ink} />
              <Text style={[styles.whereLabel, selected && { color: colors.white }]}>{w.label}</Text>
              <Text style={[styles.whereHint, selected && { color: colors.white, opacity: 0.8 }]}>{w.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={(t) => setFlow({ note: t })}
        placeholder="Anything we should know? (optional)"
        placeholderTextColor={colors.textMuted}
        style={styles.note}
        maxLength={300}
      />

      <Button title="Find out who fixes it" icon="sparkles" disabled={!photo} onPress={analyze} style={{ marginTop: spacing.lg }} />
      <Button title="Try a sample" variant="ghost" onPress={trySample} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.display, color: colors.ink },
  sub: { ...typography.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  photoBox: {
    height: 240,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    overflow: "hidden",
  },
  photoText: { ...typography.label, color: colors.ink },
  photoActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.md },
  where: { flexDirection: "row", gap: spacing.sm },
  whereCard: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, gap: 4 },
  whereSelected: { backgroundColor: colors.ink },
  whereLabel: { ...typography.label, color: colors.ink, marginTop: 4 },
  whereHint: { ...typography.caption, color: colors.textMuted },
  note: {
    ...typography.body,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
});
