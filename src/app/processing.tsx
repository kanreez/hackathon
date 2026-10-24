import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ComponentProps, useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { IconTile } from "../components/Bits";
import { Button } from "../components/Button";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { StepTracker } from "../components/StepTracker";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";
import { submitReport } from "../services/reports";
import { setFlow, useFlow } from "../state/reportFlow";

type IconName = ComponentProps<typeof Ionicons>["name"];

const STAGES: { label: string; icon: IconName }[] = [
  { label: "Looking at the photo", icon: "eye" },
  { label: "Checking safety", icon: "shield-checkmark" },
  { label: "Deciding who should fix it", icon: "git-branch" },
];

const PHOTO = 132;

// Screen 2: the "diagnosis building up" animation while the server triages the photo
export default function Processing() {
  const { photo, scope, note } = useFlow();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));
  // Two rings, half a cycle apart
  const [rings] = useState(() =>
    [0, 0.5].map((offset) => {
      const p = Animated.modulo(Animated.add(pulse, offset), 1);
      return {
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
      };
    })
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!photo?.base64) {
      router.back();
      return;
    }
    let cancelled = false;
    submitReport({ image: photo.base64, mimeType: photo.mimeType ?? "image/jpeg", scope, note })
      .then((res) => {
        if (cancelled) return;
        setFlow({ result: res });
        router.replace("/result");
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg: string = e?.message ?? "";
        setError(
          /network request failed|failed to fetch/i.test(msg)
            ? "Can't reach the backend. Start it with `npm run server` and keep it running."
            : msg || "Something went wrong."
        );
      });
    return () => {
      cancelled = true;
    };
    // Re-runs only on retry; the flow values are fixed once this screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = () => {
    setError(null);
    setStage(0);
    setAttempt((a) => a + 1);
  };

  return (
    <ScreenWrapper scroll>
      <StepTracker active={1} />
      {error ? (
        <View style={styles.center}>
          <IconTile icon="alert-circle" size={56} bg={colors.errorSoft} color={colors.error} />
          <Text style={styles.title}>That didn&apos;t work</Text>
          <Text style={styles.body}>{error}</Text>
          <Button title="Try again" icon="refresh" variant="accent" onPress={retry} style={styles.full} />
          <Button title="Back" variant="ghost" onPress={() => router.back()} style={styles.full} />
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.photoWrap}>
            {rings.map((r, i) => (
              <Animated.View key={i} style={[styles.ring, r]} />
            ))}
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.sand }]} />
            )}
          </View>
          <Text style={styles.title}>Working it out…</Text>
          <Text style={styles.body}>This usually takes a few seconds.</Text>
          <View style={styles.stages}>
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <View key={s.label} style={[styles.stage, active && styles.stageActive, i > stage && { opacity: 0.5 }]}>
                  <IconTile
                    icon={done ? "checkmark" : s.icon}
                    size={40}
                    bg={done ? colors.successSoft : active ? colors.accent : colors.sand}
                    color={done ? colors.success : colors.ink}
                  />
                  <Text style={styles.stageText}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: spacing.lg },
  full: { alignSelf: "stretch" },
  photoWrap: {
    width: PHOTO,
    height: PHOTO,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  ring: {
    position: "absolute",
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, borderWidth: 4, borderColor: colors.surface },
  title: { ...typography.h1, color: colors.ink, textAlign: "center" },
  body: { ...typography.body, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
  stages: { gap: spacing.sm, alignSelf: "stretch" },
  stage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...shadow.card,
  },
  stageActive: { borderColor: colors.accent },
  stageText: { ...typography.h3, color: colors.ink, flex: 1 },
});
