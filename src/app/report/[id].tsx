import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { IconTile, NumberedSteps, RowAction, SectionTitle, Tag, UrgentBanner } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { SeverityPill, STATUS_LABEL, StatusPill } from "../../components/StatusPill";
import { notify } from "../../components/Toast";
import { colors, radius, routeColors, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { fetchReport, generatePlan, setReportStatus } from "../../services/manager";
import { ManagerPlan, ReportStatus } from "../../types/triage";
import { timeAgo } from "../../utils/time";

// The segmented status changer; "new" shows as "Sent"
const STATUS_OPTIONS: ReportStatus[] = ["sent", "in_progress", "fixed"];

const plum = routeColors.manager;

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
  const plan = report.manager_plan;
  const loudPlan = plan && (plan.severity === "emergency" || plan.severity === "high");
  const current = report.status === "new" ? "sent" : report.status;

  return (
    <ScreenWrapper scroll>
      <Header
        eyebrow="Домоуправител"
        eyebrowColor={plum.solid}
        title="Report"
        subtitle={timeAgo(report.created_at)}
        back
      />

      {loudPlan || r.urgent ? (
        <UrgentBanner text={plan?.immediate_action ?? r.immediate_action ?? ""} style={{ marginBottom: spacing.md }} />
      ) : null}

      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.photo} contentFit="cover" />
      ) : null}

      <Card style={styles.diagCard}>
        <Text style={styles.eyebrow}>Diagnosis</Text>
        <Text style={styles.diagnosis}>{r.diagnosis}</Text>
        <View style={styles.pills}>
          <SeverityPill severity={r.severity} />
          <StatusPill status={report.status} />
        </View>
        {report.note ? <Text style={styles.muted}>Resident: “{report.note}”</Text> : null}
        {!r.urgent && r.immediate_action && !/^nothing urgent/i.test(r.immediate_action) ? (
          <Text style={styles.body}>
            <Text style={styles.strong}>Right now: </Text>
            {r.immediate_action}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.label}>Status</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {STATUS_OPTIONS.map((s) => {
          const selected = s === current;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: updating }}
              disabled={updating || selected}
              onPress={() => advance(s)}
              style={({ pressed }) => [
                styles.segBtn,
                selected && styles.segSelected,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={[styles.segText, selected && { color: colors.white }]}>{STATUS_LABEL[s]}</Text>
            </Pressable>
          );
        })}
      </View>

      {plan ? <PlanView plan={plan} /> : null}

      <Button
        title={plan ? "Regenerate plan" : "Get AI plan"}
        icon="sparkles"
        variant={plan ? "secondary" : "accent"}
        loading={planning}
        onPress={makePlan}
        style={{ marginTop: spacing.xl }}
      />
    </ScreenWrapper>
  );
}

function PlanView({ plan }: { plan: ManagerPlan }) {
  const contractor = plan.suggested_contractor;
  const call = contractor ? () => Linking.openURL(`tel:${contractor.phone.replace(/\s/g, "")}`) : undefined;

  return (
    <>
      <SectionTitle>Action plan</SectionTitle>
      {plan.uses_context.length ? (
        <View style={styles.context}>
          <Text style={styles.eyebrow}>Uses building context</Text>
          <View style={styles.chips}>
            {plan.uses_context.map((c) => (
              <Tag key={c} label={c} icon="business" bg={colors.accentSoft} color={colors.accentDeep} />
            ))}
          </View>
        </View>
      ) : null}
      <Card style={styles.block}>
        <NumberedSteps steps={plan.plan_steps} />
      </Card>

      {plan.valve_location_text && /leak|water|pipe|flood|riser|damp/i.test(`${plan.diagnosis} ${plan.immediate_action}`) ? (
        <>
          <SectionTitle>Main water valve</SectionTitle>
          <Card style={styles.block}>
            <View style={styles.rowCenter}>
              <IconTile icon="water" size={44} />
              <Text style={[styles.body, { flex: 1 }]}>{plan.valve_location_text}</Text>
            </View>
            {plan.valve_photo_url ? (
              <Image source={{ uri: plan.valve_photo_url }} style={styles.valvePhoto} contentFit="cover" />
            ) : null}
          </Card>
        </>
      ) : null}

      {contractor ? (
        <>
          <SectionTitle>Suggested contractor</SectionTitle>
          <Card style={styles.rowCard} onPress={call}>
            <IconTile icon="construct" size={48} bg={plum.solid} color={colors.white} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.blockTitle}>{contractor.name}</Text>
              <Text style={styles.caption}>{contractor.phone}</Text>
              <Text style={styles.caption}>{contractor.why}</Text>
            </View>
            <RowAction icon="call" label={`Call ${contractor.name}`} />
          </Card>
        </>
      ) : null}

      <SectionTitle>Budget</SectionTitle>
      <Card>
        <Text style={styles.body}>{plan.budget_note}</Text>
      </Card>

      <SectionTitle>Notice to residents</SectionTitle>
      <Card style={styles.block}>
        <Text selectable style={styles.body}>
          {plan.resident_notice}
        </Text>
        <Button
          title="Share"
          icon="share-outline"
          variant="secondary"
          size="sm"
          style={{ alignSelf: "flex-start", marginTop: spacing.xs }}
          onPress={() => Share.share({ message: plan.resident_notice }).catch(() => notify("Could not share", "error"))}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { height: 220, borderRadius: radius.xl, backgroundColor: colors.sand, marginBottom: spacing.md },
  diagCard: { gap: spacing.sm, padding: spacing.lg },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted },
  diagnosis: { ...typography.h2, color: colors.ink },
  pills: { flexDirection: "row", gap: 6 },
  body: { ...typography.body, color: colors.ink },
  strong: { fontFamily: typography.label.fontFamily },
  muted: { ...typography.body, color: colors.textMuted },
  caption: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.label, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  segment: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
  },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segSelected: { backgroundColor: colors.ink },
  segText: { ...typography.label, color: colors.ink },
  context: { gap: spacing.sm, marginBottom: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  block: { gap: spacing.sm },
  blockTitle: { ...typography.h3, color: colors.ink },
  rowCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  valvePhoto: { height: 160, borderRadius: radius.md, backgroundColor: colors.sand },
});
