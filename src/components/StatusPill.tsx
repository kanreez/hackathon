import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../constants/theme";
import { ReportStatus, Severity } from "../types/triage";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "New",
  sent: "Sent",
  in_progress: "In progress",
  fixed: "Fixed",
};

const STATUS_COLORS: Record<ReportStatus, { bg: string; fg: string }> = {
  new: { bg: colors.secondary, fg: colors.ink },
  sent: { bg: colors.accentSoft, fg: colors.ink },
  in_progress: { bg: colors.ink, fg: colors.white },
  fixed: { bg: "#DDF3EA", fg: colors.success },
};

export function StatusPill({ status }: { status: ReportStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const loud = severity === "emergency" || severity === "high";
  return (
    <View style={[styles.pill, { backgroundColor: loud ? colors.error : colors.secondary }]}>
      <Text style={[styles.text, { color: loud ? colors.white : colors.ink }]}>{severity}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  text: { ...typography.label, fontSize: 12, lineHeight: 15, textTransform: "capitalize" },
});
