import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RowAction, SectionTitle } from "../../components/Bits";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { SeverityPill, StatusPill } from "../../components/StatusPill";
import { colors, radius, routeColors, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { fetchInbox } from "../../services/manager";
import { Report } from "../../types/triage";
import { timeAgo } from "../../utils/time";

const POLL_MS = 8000;

// Домоуправител Screen 1: incoming reports for the building
export default function Inbox() {
  const { data, loading, refreshing, error, reload, refresh, setData } = useAsync(fetchInbox);

  useRefreshOnFocus(refresh);

  // Poll so new reports show up without pulling to refresh
  useEffect(() => {
    const t = setInterval(() => {
      fetchInbox().then(setData).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [setData]);

  const reports = data ?? [];
  const open = reports.filter((r) => r.status !== "fixed");
  const done = reports.filter((r) => r.status === "fixed");
  const summary = [
    { label: "New", count: reports.filter((r) => r.status === "new" || r.status === "sent").length },
    { label: "In progress", count: reports.filter((r) => r.status === "in_progress").length },
    { label: "Fixed", count: done.length },
  ];

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh}>
      <Header
        eyebrow="Домоуправител"
        eyebrowColor={routeColors.manager.solid}
        title="Inbox"
        subtitle={open.length ? `${open.length} open in your building` : "Reports from your building"}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !reports.length ? (
        <EmptyState icon="file-tray-outline" title="No reports yet" body="When a resident reports a problem in the building, it shows up here." />
      ) : (
        <>
          <View style={styles.summary}>
            {summary.map((s) => (
              <Card key={s.label} style={styles.summaryTile}>
                <Text style={styles.summaryCount}>{s.count}</Text>
                <Text style={styles.caption}>{s.label}</Text>
              </Card>
            ))}
          </View>
          {open.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
          {done.length ? <SectionTitle muted>Fixed</SectionTitle> : null}
          {done.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </>
      )}
    </ScreenWrapper>
  );
}

function ReportRow({ report }: { report: Report }) {
  const loud = report.ai_result.severity === "emergency" || report.ai_result.severity === "high";
  return (
    <Card
      style={[styles.row, report.status === "fixed" && { opacity: 0.7 }]}
      onPress={() => router.push({ pathname: "/report/[id]", params: { id: report.id } })}
      accessibilityLabel={`${report.ai_result.diagnosis}, ${report.status}`}
    >
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          {loud ? <View style={styles.dot} accessibilityLabel="Urgent" /> : null}
          <Text style={styles.title} numberOfLines={2}>
            {report.ai_result.diagnosis}
          </Text>
        </View>
        <View style={styles.pills}>
          <StatusPill status={report.status} />
          <SeverityPill severity={report.ai_result.severity} />
          {report.manager_plan ? <Ionicons name="sparkles" size={16} color={colors.accentDeep} /> : null}
        </View>
        <Text style={styles.caption}>{timeAgo(report.created_at)}</Text>
      </View>
      <RowAction icon="chevron-forward" label="Open report" />
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  summaryTile: { flex: 1, gap: 2, paddingVertical: 14 },
  summaryCount: { ...typography.h1, color: colors.ink },
  row: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm, alignItems: "center", padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.sand },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginTop: 7 },
  title: { ...typography.h3, color: colors.ink, flex: 1 },
  pills: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  caption: { ...typography.caption, color: colors.textMuted },
});
