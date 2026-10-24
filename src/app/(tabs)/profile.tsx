import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
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

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header title="Profile" />

      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={changePhoto}>
          <Avatar uri={avatarUrl} name={fullName || user?.email} size={88} />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName || "No name yet"}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
          <Button
            title={avatarUrl ? "Change photo" : "Add photo"}
            icon="camera-outline"
            size="sm"
            variant="secondary"
            loading={uploading}
            onPress={changePhoto}
            style={{ alignSelf: "flex-start", marginTop: spacing.sm }}
          />
        </View>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your details</Text>
          {error ? (
            <Text style={styles.warning}>
              Couldn't load your profile: {error}. Check that the profiles table exists and you have a row in it.
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
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <Text style={styles.email}>
          You are using the app as {role === "manager" ? "the building manager (домоуправител)" : "a resident"}.
        </Text>
        {canSwitch ? (
          <Button
            title={role === "manager" ? "Switch to resident" : "Switch to building manager"}
            icon="swap-horizontal"
            variant="secondary"
            loading={switching}
            onPress={toggleRole}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Button title="Log out" icon="log-out-outline" variant="secondary" onPress={onLogout} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 640, width: "100%", alignSelf: "center" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  name: { ...typography.h2, color: colors.ink },
  email: { ...typography.body, color: colors.textMuted },
  section: { gap: spacing.md, marginTop: spacing.xl },
  sectionTitle: { ...typography.h2, color: colors.ink },
  warning: {
    ...typography.caption,
    color: colors.error,
    backgroundColor: colors.errorSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
