import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconTile, StickerHeadline } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { StepTracker } from "../../components/StepTracker";
import { notify } from "../../components/Toast";
import { colors, radius, shadow, spacing, typography } from "../../constants/theme";
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
      <StepTracker active={0} />

      <Text style={styles.eyebrow}>Report a problem</Text>
      <StickerHeadline lead="Something" sticker="broke?" />
      <Text style={styles.sub}>Snap it. We tell you who should fix it, and what to do right now.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photo ? "Retake photo" : "Take a photo"}
        onPress={() => capture("camera")}
        style={({ pressed }) => [styles.hero, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.retake}>
              <Ionicons name="camera-reverse" size={16} color={colors.ink} />
              <Text style={styles.retakeText}>Retake</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.shutterRing}>
              <View style={styles.shutter}>
                <Ionicons name="camera" size={30} color={colors.white} />
              </View>
            </View>
            <Text style={styles.heroTitle}>Tap to snap the problem</Text>
            <Text style={styles.heroHint}>Leak, crack, broken window, dead light…</Text>
          </>
        )}
      </Pressable>
      <View style={styles.photoActions}>
        <Button title="From gallery" icon="images" size="sm" variant="secondary" onPress={() => capture("library")} />
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
              style={({ pressed }) => [
                styles.whereCard,
                selected && styles.whereSelected,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconTile icon={w.icon} size={40} bg={selected ? colors.accent : colors.sand} />
              <Text style={[styles.whereLabel, selected && { color: colors.white }]}>{w.label}</Text>
              <Text style={[styles.whereHint, selected && { color: colors.border }]}>{w.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Input
          value={note}
          onChangeText={(t) => setFlow({ note: t })}
          placeholder="Anything we should know? (optional)"
          maxLength={300}
        />
      </View>

      <Button
        title="Find out who fixes it"
        icon="sparkles"
        variant="accent"
        disabled={!photo}
        onPress={analyze}
        style={{ marginTop: spacing.lg }}
      />
      {!photo ? <Text style={styles.ctaHint}>Add a photo first. It takes 5 seconds.</Text> : null}
      <Button title="Try a sample" variant="ghost" onPress={trySample} style={{ marginTop: spacing.xs }} />
    </ScreenWrapper>
  );
}

const CORNER = 28;

const styles = StyleSheet.create({
  eyebrow: { ...typography.eyebrow, color: colors.accentDeep, marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.lg },
  hero: {
    height: 300,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    overflow: "hidden",
    ...shadow.glow,
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.ink, opacity: 0.85 },
  tl: { top: 22, left: 22, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 22, right: 22, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 22, left: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 22, right: 22, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  shutterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { ...typography.h3, color: colors.ink },
  heroHint: { ...typography.caption, color: colors.ink, opacity: 0.75 },
  retake: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.float,
  },
  retakeText: { ...typography.label, color: colors.ink },
  photoActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.md },
  where: { flexDirection: "row", gap: spacing.sm },
  whereCard: {
    flex: 1,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 4,
    ...shadow.card,
  },
  whereSelected: { backgroundColor: colors.ink },
  whereLabel: { ...typography.label, color: colors.ink, marginTop: spacing.sm },
  whereHint: { ...typography.caption, color: colors.textMuted },
  ctaHint: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
