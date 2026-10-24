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
import { supabase } from "../../services/supabase";
import { getProfile, ProfileUpdate, updateProfile } from "../../services/userService";

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: profile, loading, error, setData } = useAsync(
    () => (user ? getProfile(user.id) : Promise.resolve(null)),
    [user?.id]
  );

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
    setUsername(profile?.username ?? "");
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
      await persist({ full_name: fullName.trim() || null, username: username.trim() || null });
      notify("Profile saved");
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
      <Header title="Profile" />

      <View style={styles.hero}>
        <Avatar name={fullName || user?.email} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName || "No name yet"}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      </View>

      <Card style={styles.list}>
        <SettingRow icon="home" label="Your garages" hint="List a garage and pair its door" onPress={() => router.push("/host")} />
        <SettingRow icon="key" label="My bookings" onPress={() => router.navigate("/bookings")} divider />
      </Card>

      {loading ? (
        <Loading />
      ) : (
        <>
          <SectionTitle>Your details</SectionTitle>
          <Card style={styles.details}>
            {error ? (
              <Text style={styles.warning}>
                Couldn&apos;t load your profile: {error}. Check that the profiles table exists and you have a row in it.
              </Text>
            ) : null}
            <Input label="Full name" placeholder="Maria Ivanova" value={fullName} onChangeText={setFullName} />
            <Input
              label="Username"
              placeholder="maria"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <Button title="Save profile" loading={saving} onPress={save} />
          </Card>
        </>
      )}

      <Button title="Log out" icon="log-out-outline" variant="danger" onPress={onLogout} style={{ marginTop: spacing.xl }} />
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
