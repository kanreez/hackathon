import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";
import { useT } from "../i18n";
import { uploadGaragePhoto } from "../services/garages";
import { pickGaragePhoto } from "../utils/photo";
import { Button } from "./Button";
import { notify } from "./Toast";

type Props = {
  value: string | null; // the photo's URL
  onChange: (url: string | null) => void;
  onBusy?: (busy: boolean) => void; // while uploading, so the form can wait before saving
};

// The garage's photo: choose one from the phone (or take one) and it uploads straight away;
// the listing keeps its URL. A browser has no camera button: its file picker covers it.
export function PhotoField({ value, onChange, onBusy }: Props) {
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // the local file, shown while it uploads

  const add = async (source: "library" | "camera") => {
    try {
      const photo = await pickGaragePhoto(source);
      if (!photo) return;
      setPreview(photo.uri);
      setUploading(true);
      onBusy?.(true);
      onChange(await uploadGaragePhoto(photo.base64));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setUploading(false);
      setPreview(null);
      onBusy?.(false);
    }
  };

  const shown = preview ?? value;
  const camera = Platform.OS !== "web";

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{t("photo.label")}</Text>
      {shown ? (
        <View style={styles.frame}>
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t("photo.alt")} transition={150} />
          {uploading ? (
            <View style={styles.veil}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.veilText}>{t("photo.uploading")}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.frame, styles.empty]}>
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t("photo.add")}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Button
          title={value ? t("photo.change") : t("photo.choose")}
          icon="images-outline"
          size="sm"
          variant="secondary"
          disabled={uploading}
          onPress={() => add("library")}
        />
        {camera ? <Button title={t("photo.take")} icon="camera-outline" size="sm" variant="secondary" disabled={uploading} onPress={() => add("camera")} /> : null}
        {value && !uploading ? <Button title={t("photo.remove")} icon="trash-outline" size="sm" variant="ghost" onPress={() => onChange(null)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.ink },
  frame: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.sand },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  veil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "rgba(21, 23, 26, 0.6)" },
  veilText: { ...typography.label, color: colors.ink },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
