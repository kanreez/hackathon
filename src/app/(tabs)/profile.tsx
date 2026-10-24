import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { IconTile, SectionTitle, Tag } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, routeColors, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useRole } from "../../context/RoleContext";
import { useAsync } from "../../hooks/useAsync";
import { uploadImage } from "../../services/storage";
import { supabase } from "../../services/supabase";
import { getProfile, ProfileUpdate, updateProfile } from "../../services/userService";
import { pickImage } from "../../utils/media";

export default function Profile() {
  const { user, logout } = useAuth();
  const { role, canSwitch, setRole } = useRole();
  const [switching, setSwitching] = useState(false);
  const { data: profile, loading, error, setData } = useAsync(
    () => (user ? getProfile(user.id) : Promise.resolve(null)),
    [user?.id]
  );

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
    setUsername(profile?.username ?? "");
  }, [profile, user]);

  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  // Saves to the profiles table and to the login's metadata, so Home sees the change too
  const persist = async (updates: ProfileUpdate) => {
    if (!user) return;
    const saved = await updateProfile(user.id, updates);
    setData(saved);
    await supabase.auth.updateUser({
      data: { full_name: saved.full_name, avatar_url: saved.avatar_url },
    });
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

  const changePhoto = async () => {
    if (!user) return;
    try {
      const img = await pickImage({ base64: true });
      if (!img) return;
      setUploading(true);
      const url = await uploadImage(img, user.id);
      await persist({ avatar_url: url });
      notify("Photo updated");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const toggleRole = async () => {
    try {
      setSwitching(true);
      await setRole(role === "manager" ? "resident" : "manager");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSwitching(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const isManager = role === "manager";

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header title="Profile" />

      <View style={styles.hero}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={changePhoto}>
          <Avatar uri={avatarUrl} name={fullName || user?.email} size={72} />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName || "No name yet"}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={{ marginTop: 4 }}>
            {isManager ? (
              <Tag label="Домоуправител" icon="business" color={routeColors.manager.solid} outline />
            ) : (
              <Tag label="Resident" icon="home" bg={colors.sand} />
            )}
          </View>
        </View>
      </View>

      <Card style={styles.list}>
        <SettingRow
          icon="camera"
          label={uploading ? "Uploading photo…" : avatarUrl ? "Change photo" : "Add photo"}
          onPress={uploading ? undefined : changePhoto}
        />
        {canSwitch ? (
          <SettingRow
            icon="swap-horizontal"
            label={switching ? "Switching…" : isManager ? "Switch to resident" : "Switch to building manager"}
            hint="Demo only"
            onPress={switching ? undefined : toggleRole}
            divider
          />
        ) : null}
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
    color: colors.error,
    backgroundColor: colors.errorSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
