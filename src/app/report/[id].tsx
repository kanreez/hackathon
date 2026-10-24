import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { SeverityPill, STATUS_LABEL, StatusPill } from "../../components/StatusPill";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { fetchReport, generatePlan, setReportStatus } from "../../services/manager";
import { ManagerPlan, ReportStatus } from "../../types/triage";
import { timeAgo } from "../../utils/time";

const NEXT_STATUS: Partial<Record<ReportStatus, ReportStatus>> = {
  new: "in_progress",
  sent: "in_progress",
  in_progress: "fixed",
};

// Домоуправител Screens 2-3: the report, then the AI action plan built from the building context
export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: report, loading, error, reload, setData } = useAsync(() => fetchReport(id), [id]);
  const [planning, setPlanning] = useState(false);
  const [updating, setUpdating] = useState(false);

  const makePlan = async () => {
    try {
      setPlanning(true);
      setData(await generatePlan(id));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setPlanning(false);
    }
  };

  const advance = async (status: ReportStatus) => {
    try {
      setUpdating(true);
      setData(await setReportStatus(id, status));
      notify(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <Header title="Report" back />
        <Loading />
      </ScreenWrapper>
    );
  }
  if (error || !report) {
    return (
      <ScreenWrapper>
        <Header title="Report" back />
        <ErrorState message={error ?? "Report not found"} onRetry={reload} />
      </ScreenWrapper>
    );
  }

  const r = report.ai_result;
  const next = NEXT_STATUS[report.status];

  return (
    <ScreenWrapper scroll>
      <Header title="Report" subtitle={timeAgo(report.created_at)} back />

      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.photo} contentFit="cover" />
      ) : null}

      <View style={styles.pills}>
        <StatusPill status={report.status} />
        <SeverityPill severity={r.severity} />
      </View>
      <Text style={styles.diagnosis}>{r.diagnosis}</Text>
      {report.note ? <Text style={styles.muted}>Resident: “{report.note}”</Text> : null}
      {r.immediate_action && !/^nothing urgent/i.test(r.immediate_action) ? (
        <Text style={styles.body}>Right now: {r.immediate_action}</Text>
      ) : null}

      {report.manager_plan ? (
        <PlanView plan={report.manager_plan} />
      ) : (
        <Button
          title="Make an action plan"
          icon="sparkles"
          loading={planning}
          onPress={makePlan}
          style={{ marginTop: spacing.lg }}
        />
      )}

      {next ? (
        <Button
          title={`Mark as ${STATUS_LABEL[next].toLowerCase()}`}
          icon={next === "fixed" ? "checkmark-done" : "construct"}
          variant={report.manager_plan ? "primary" : "secondary"}
          loading={updating}
          onPress={() => advance(next)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
      {report.manager_plan ? (
        <Button title="Regenerate plan" variant="ghost" loading={planning} onPress={makePlan} />
      ) : null}
    </ScreenWrapper>
  );
}

function PlanView({ plan }: { plan: ManagerPlan }) {
  return (
    <>
      {plan.severity === "emergency" || plan.severity === "high" ? (
        <View style={styles.urgent}>
          <Ionicons name="warning" size={22} color={colors.white} />
          <Text style={styles.urgentText}>{plan.immediate_action}</Text>
        </View>
      ) : null}

      {plan.uses_context.length ? (
        <>
          <Text style={styles.section}>From your building context</Text>
          <Card style={styles.contextCard}>
            {plan.uses_context.map((c) => (
              <View key={c} style={styles.contextRow}>
                <Ionicons name="business" size={16} color={colors.ink} style={{ marginTop: 3 }} />
                <Text style={[styles.body, { flex: 1 }]}>{c}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {plan.valve_location_text && /leak|water|pipe|flood|riser|damp/i.test(`${plan.diagnosis} ${plan.immediate_action}`) ? (
        <>
          <Text style={styles.section}>Main water valve</Text>
          <Card style={styles.block}>
            <Text style={styles.body}>{plan.valve_location_text}</Text>
            {plan.valve_photo_url ? (
              <Image source={{ uri: plan.valve_photo_url }} style={styles.valvePhoto} contentFit="cover" />
            ) : null}
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Action plan</Text>
      <Card style={styles.block}>
        {plan.plan_steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={[styles.body, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
      </Card>

      {plan.suggested_contractor ? (
        <>
          <Text style={styles.section}>Suggested contractor</Text>
          <Card
            style={styles.rowCard}
            onPress={() => Linking.openURL(`tel:${plan.suggested_contractor!.phone.replace(/\s/g, "")}`)}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.blockTitle}>{plan.suggested_contractor.name}</Text>
              <Text style={styles.muted}>{plan.suggested_contractor.why}</Text>
              <Text style={styles.muted}>{plan.suggested_contractor.phone}</Text>
            </View>
            <Ionicons name="call" size={20} color={colors.ink} />
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Budget</Text>
      <Text style={styles.body}>{plan.budget_note}</Text>

      <Text style={styles.section}>Notice to residents</Text>
      <Card style={styles.block}>
        <Text selectable style={styles.body}>
          {plan.resident_notice}
        </Text>
      </Card>
      <Button
        title="Share notice"
        icon="share-outline"
        variant="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => Share.share({ message: plan.resident_notice }).catch(() => notify("Could not share", "error"))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { height: 220, borderRadius: radius.xl, backgroundColor: colors.secondary, marginBottom: spacing.md },
  pills: { flexDirection: "row", gap: 6 },
  diagnosis: { ...typography.h2, color: colors.ink, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.ink },
  muted: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  block: { gap: spacing.sm },
  blockTitle: { ...typography.h3, color: colors.ink },
  contextCard: { gap: spacing.sm, backgroundColor: colors.accentSoft },
  contextRow: { flexDirection: "row", gap: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: { ...typography.h3, color: colors.textMuted, width: 20 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  valvePhoto: { height: 160, borderRadius: radius.md, backgroundColor: colors.secondary },
  urgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  urgentText: { ...typography.h3, color: colors.white, flex: 1 },
});
