import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { IconTile, SectionTitle } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useT } from "../../i18n";
import { supabase } from "../../services/supabase";
import { getProfile, ProfileUpdate, updateProfile } from "../../services/userService";

export default function Profile() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const { data: profile, loading, error, setData } = useAsync(
    () => (user ? getProfile(user.id) : Promise.resolve(null)),
    [user?.id]
  );

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
  }, [profile, user]);

  // Saves to the profiles table and to the login's metadata
  const persist = async (updates: ProfileUpdate) => {
    if (!user) return;
    const saved = await updateProfile(user.id, updates);
    setData(saved);
    await supabase.auth.updateUser({ data: { full_name: saved.full_name } });
  };

  const save = async () => {
    try {
      setSaving(true);
      // The username is changed in Settings, where the server checks nobody else has it
      await persist({ full_name: fullName.trim() || null });
      notify(t("profile.saved"));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header title={t("profile.title")} />

      <View style={styles.hero}>
        <Avatar name={fullName || user?.email} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName || t("profile.noName")}
          </Text>
          {profile?.username ? (
            <Text style={styles.handle} numberOfLines={1}>
              @{profile.username}
            </Text>
          ) : null}
          <Text style={styles.caption} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      </View>

      <Card style={styles.list}>
        <SettingRow icon="settings" label={t("profile.settings")} hint={t("profile.settingsHint")} onPress={() => router.push("/settings")} />
        <SettingRow icon="home" label={t("profile.garages")} hint={t("profile.garagesHint")} onPress={() => router.push("/host")} divider />
        <SettingRow icon="key" label={t("profile.bookings")} onPress={() => router.navigate("/bookings")} divider />
      </Card>

      {loading ? (
        <Loading />
      ) : (
        <>
          <SectionTitle>{t("profile.details")}</SectionTitle>
          <Card style={styles.details}>
            {error ? (
              <Text style={styles.warning}>
                {t("profile.loadError", { error })}
              </Text>
            ) : null}
            <Input label={t("profile.fullName")} placeholder={t("profile.fullNamePlaceholder")} value={fullName} onChangeText={setFullName} />
            <Button title={t("profile.save")} loading={saving} onPress={save} />
          </Card>
        </>
      )}

      <Button title={t("profile.logout")} icon="log-out-outline" variant="danger" onPress={onLogout} style={{ marginTop: spacing.xl }} />
    </ScreenWrapper>
  );
}

type SettingRowProps = {
  icon: ComponentProps<typeof IconTile>["icon"];
  label: string;
  hint?: string;
  onPress?: () => void;
  divider?: boolean;
};

function SettingRow({ icon, label, hint, onPress, divider }: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.setting, divider && styles.divider, pressed && { opacity: 0.7 }]}
    >
      <IconTile icon={icon} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {hint ? <Text style={styles.caption}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 640, width: "100%", alignSelf: "center" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
  },
  name: { ...typography.h2, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  handle: { ...typography.label, color: colors.accentDeep },
  list: { marginTop: spacing.lg, paddingVertical: spacing.xs },
  setting: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  settingLabel: { ...typography.h3, color: colors.ink },
  details: { gap: spacing.md, padding: spacing.lg },
  warning: {
    ...typography.caption,
    color: colors.errorText,
    backgroundColor: colors.errorSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
