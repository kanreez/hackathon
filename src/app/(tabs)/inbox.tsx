import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { EmptyState, ErrorState, Loading } from "../../components/StateViews";
import { SeverityPill, StatusPill } from "../../components/StatusPill";
import { colors, radius, spacing, typography } from "../../constants/theme";
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

  return (
    <ScreenWrapper scroll refreshing={refreshing} onRefresh={refresh}>
      <Header title="Inbox" subtitle={open.length ? `${open.length} open in your building` : "Reports from your building"} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !reports.length ? (
        <EmptyState icon="file-tray-outline" title="No reports yet" body="When a resident reports a problem in the building, it shows up here." />
      ) : (
        <>
          {open.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
          {done.length ? <Text style={styles.section}>Fixed</Text> : null}
          {done.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </>
      )}
    </ScreenWrapper>
  );
}

function ReportRow({ report }: { report: Report }) {
  return (
    <Card
      style={styles.row}
      onPress={() => router.push({ pathname: "/report/[id]", params: { id: report.id } })}
    >
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={2}>
          {report.ai_result.diagnosis}
        </Text>
        <View style={styles.pills}>
          <StatusPill status={report.status} />
          <SeverityPill severity={report.ai_result.severity} />
          {report.manager_plan ? <Ionicons name="sparkles" size={16} color={colors.ink} /> : null}
        </View>
        <Text style={styles.meta}>{timeAgo(report.created_at)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm, alignItems: "center" },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.secondary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 6 },
  title: { ...typography.h3, color: colors.ink },
  pills: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { ...typography.caption, color: colors.textMuted },
});
