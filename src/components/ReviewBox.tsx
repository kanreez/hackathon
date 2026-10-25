import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { useT } from "../i18n";
import { saveReview } from "../services/garages";
import { Booking } from "../types/garage";
import { Button } from "./Button";
import { Input } from "./Input";
import { StarPicker, Stars } from "./Stars";
import { notify } from "./Toast";

const MAX_COMMENT = 500; // same limit as the server

// The server accepts a review once the booking is paid and has started
export const canReview = (b: Booking, now: Date) => b.status === "paid" && new Date(b.starts_at) <= now;

// Rate a stay from My bookings: a quiet button, then stars and an optional comment.
// Saving again edits the same review.
export function ReviewBox({ booking, onSaved }: { booking: Booking; onSaved?: () => void }) {
  const { t } = useT();
  const existing = booking.review;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      await saveReview(booking.id, rating, comment.trim());
      notify(existing ? t("review.updated") : t("review.thanks"));
      setEditing(false);
      onSaved?.();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    if (!existing) {
      return (
        <Button title={t("review.rate")} icon="star-outline" size="sm" variant="secondary" onPress={() => setEditing(true)} style={styles.start} />
      );
    }
    return (
      <View style={styles.mine}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.mineHead}>
            <Text style={styles.label}>{t("review.yours")}</Text>
            <Stars value={existing.rating} size={13} />
          </View>
          {existing.comment ? <Text style={styles.comment}>{existing.comment}</Text> : null}
        </View>
        <Button title={t("common.edit")} size="sm" variant="ghost" onPress={() => setEditing(true)} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{t("review.howWasIt")}</Text>
      <StarPicker value={rating} onChange={setRating} />
      <Input
        value={comment}
        onChangeText={setComment}
        placeholder={t("review.placeholder")}
        multiline
        maxLength={MAX_COMMENT}
        accessibilityLabel={t("review.comment")}
        style={{ minHeight: 80 }}
      />
      <View style={styles.actions}>
        <Button title={t("common.cancel")} size="sm" variant="ghost" disabled={saving} onPress={() => setEditing(false)} />
        <Button
          title={existing ? t("review.saveChanges") : t("review.post")}
          size="sm"
          variant="primary"
          loading={saving}
          disabled={!rating}
          onPress={save}
        />
      </View>
      {!rating ? <Text style={styles.hint}>{t("review.pickFirst")}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  mine: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  mineHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...typography.label, color: colors.ink },
  comment: { ...typography.body, color: colors.ink },
  form: { gap: spacing.sm, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: "right" },
});
