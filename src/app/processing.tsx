import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { colors, spacing, typography } from "../constants/theme";
import { submitReport } from "../services/reports";
import { setFlow, useFlow } from "../state/reportFlow";

const STAGES = ["Looking at the photo", "Checking safety", "Deciding who should fix it"];

// Screen 2: the "diagnosis building up" animation while the server triages the photo
export default function Processing() {
  const { photo, scope, note } = useFlow();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
    <ScreenWrapper>
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name="alert-circle" size={44} color={colors.error} />
            <Text style={styles.title}>That didn&apos;t work</Text>
            <Text style={styles.body}>{error}</Text>
            <Button title="Try again" onPress={retry} />
            <Button title="Back" variant="ghost" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Working it out…</Text>
            <View style={styles.stages}>
              {STAGES.map((label, i) => (
                <View key={label} style={[styles.stage, i > stage && { opacity: 0.25 }]}>
                  <Ionicons
                    name={i < stage ? "checkmark-circle" : i === stage ? "ellipse" : "ellipse-outline"}
                    size={22}
                    color={i < stage ? colors.success : colors.ink}
                  />
                  <Text style={styles.stageText}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: spacing.md },
  title: { ...typography.h1, color: colors.ink },
  body: { ...typography.body, color: colors.textMuted },
  stages: { gap: spacing.md, marginTop: spacing.md },
  stage: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stageText: { ...typography.h3, color: colors.ink },
});
