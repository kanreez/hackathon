import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { Button } from "./Button";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.ink} />
      {label ? <Text style={styles.body}>{label}</Text> : null}
    </View>
  );
}

type EmptyProps = {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// An empty screen should tell the user what to do next
export function EmptyState({ icon = "sparkles-outline", title, body, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.box}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.ink} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} size="sm" onPress={onAction} /> : null}
    </View>
  );
}

type ErrorProps = { message: string; onRetry?: () => void };

export function ErrorState({ message, onRetry }: ErrorProps) {
  return (
    <View style={styles.box}>
      <View style={[styles.iconWrap, { backgroundColor: colors.errorSoft }]}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.error} />
      </View>
      <Text style={styles.title}>Couldn't load this</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm, maxWidth: 420 },
});
