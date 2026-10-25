import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { ErrorState, Loading } from "../components/StateViews";
import { notify } from "../components/Toast";
import { colors, spacing, typography } from "../constants/theme";
import { useAsync } from "../hooks/useAsync";
import { LANGS, useLanguage, useT } from "../i18n";
import { translateError } from "../i18n/errors";
import { checkUsername, getMe, saveUsername } from "../services/account";

const CHECK_DELAY_MS = 400; // wait for a pause in typing before asking the server

// Settings: change your username (if it's free) and the app's language
export default function Settings() {
  const { t } = useT();
  const { data, loading, error, reload, setData } = useAsync(getMe);

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header title={t("settings.title")} back backTo="/profile" />
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? ""} onRetry={reload} />
      ) : (
        <UsernameCard
          current={data.profile?.username ?? null}
          onSaved={(username) => setData({ ...data, profile: { full_name: data.profile?.full_name ?? null, username } })}
        />
      )}
      <LanguageCard />
    </ScreenWrapper>
  );
}

type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string };

function UsernameCard({ current, onSaved }: { current: string | null; onSaved: (u: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState(current ?? "");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [saving, setSaving] = useState(false);

  const wanted = value.trim().toLowerCase();
  const unchanged = wanted === (current ?? "").toLowerCase();

  // Live check, after a short pause in typing; a newer keystroke cancels the older check
  useEffect(() => {
    if (!wanted || unchanged) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setCheck({ state: "checking" });
      checkUsername(wanted)
        .then((r) => !cancelled && setCheck(r.available ? { state: "ok" } : { state: "bad", message: translateError(r.problem ?? "") }))
        .catch((e) => !cancelled && setCheck({ state: "bad", message: e.message }));
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, unchanged]);

  const save = async () => {
    try {
      setSaving(true);
      const saved = await saveUsername(wanted);
      setValue(saved);
      setCheck({ state: "idle" });
      onSaved(saved);
      notify(t("settings.usernameSaved"));
    } catch (e: any) {
      setCheck({ state: "bad", message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const status = unchanged || !wanted ? null : check;

  return (
    <Card style={styles.group}>
      <Text style={styles.groupTitle}>{t("settings.username")}</Text>
      <Text style={styles.caption}>{current ? t("settings.usernameHint") : t("settings.usernameNone")}</Text>
      <Input
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setCheck({ state: "idle" });
        }}
        placeholder="ivan.petrov"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        maxLength={20}
        accessibilityLabel={t("settings.username")}
      />
      {status?.state === "checking" ? <Text style={styles.caption}>{t("settings.checking")}</Text> : null}
      {status?.state === "ok" ? (
        <Text style={[styles.status, { color: colors.success }]} accessibilityLiveRegion="polite">
          {t("settings.available")}
        </Text>
      ) : null}
      {status?.state === "bad" ? (
        <Text style={[styles.status, { color: colors.errorText }]} accessibilityLiveRegion="polite">
          {status.message}
        </Text>
      ) : null}
      <Button
        title={t("settings.saveUsername")}
        variant="accent"
        loading={saving}
        disabled={unchanged || status?.state !== "ok"}
        onPress={save}
        style={{ alignSelf: "flex-start" }}
      />
    </Card>
  );
}

function LanguageCard() {
  const { t } = useT();
  const { lang, setLang } = useLanguage();
  return (
    <Card style={styles.group}>
      <Text style={styles.groupTitle}>{t("settings.language")}</Text>
      <View accessibilityRole="radiogroup">
        {LANGS.map((l, i) => {
          const selected = l.value === lang;
          return (
            <Pressable
              key={l.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setLang(l.value)}
              style={({ pressed }) => [styles.langRow, i > 0 && styles.divider, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.langLabel}>{l.label}</Text>
              <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.accentDeep : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 640, width: "100%", alignSelf: "center" },
  group: { gap: spacing.sm, padding: spacing.lg, marginBottom: spacing.md },
  groupTitle: { ...typography.h3, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  status: { ...typography.label },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  langLabel: { ...typography.h3, color: colors.ink },
});
