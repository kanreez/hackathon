import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import { IconTile, NumberedSteps, RowAction, SectionTitle, Tag, UrgentBanner } from "../components/Bits";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { EmptyState } from "../components/StateViews";
import { StepTracker } from "../components/StepTracker";
import { notify } from "../components/Toast";
import { colors, radius, routeColors, spacing, typography } from "../constants/theme";
import { SeverityPill, STATUS_LABEL, StatusPill } from "../components/StatusPill";
import { fetchReport } from "../services/manager";
import { fetchSpecialists, fetchStores } from "../services/reports";
import { resetFlow, useFlow } from "../state/reportFlow";
import { ReportStatus, Route, Specialist, Store, TriageResult } from "../types/triage";
import { getCurrentLocation } from "../utils/location";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ROUTE_META: Record<Route, { title: string; label: string; icon: IconName }> = {
  diy: { title: "You can fix this yourself", label: "DIY", icon: "hammer" },
  specialist: { title: "Call a specialist", label: "Specialist", icon: "call" },
  manager: { title: "Sent to your building manager", label: "Домоуправител", icon: "business" },
  neighbor: { title: "Talk to your neighbour above", label: "Neighbour", icon: "chatbubbles" },
};

// Screen 3: result for all four routes
export default function Result() {
  const { result } = useFlow();

  if (!result) {
    // Landed here without a result (e.g. a reload): go back to the start
    return (
      <ScreenWrapper>
        <EmptyState
          icon="camera"
          title="Nothing to show yet"
          body="Snap a problem first and we'll work out who fixes it."
          actionLabel="Report a problem"
          onAction={() => router.replace("/")}
        />
      </ScreenWrapper>
    );
  }

  const r = result.ai_result;
  const meta = ROUTE_META[r.route];
  const rc = routeColors[r.route];
  const pct = Math.round(r.confidence * 100);

  return (
    <ScreenWrapper scroll>
      <StepTracker active={2} />

      {r.urgent ? <UrgentBanner text={r.immediate_action} style={{ marginBottom: spacing.md }} /> : null}

      <View style={[styles.hero, { backgroundColor: rc.tint }]}>
        <View style={styles.heroTop}>
          <IconTile icon={meta.icon} size={56} bg={rc.solid} color={colors.white} />
          <Tag label={meta.label} color={rc.solid} outline />
        </View>
        <Text style={styles.heroTitle}>{meta.title}</Text>
        <Text style={styles.heroBody}>{r.route_reason}</Text>
      </View>

      <Card style={styles.diagCard}>
        <Text style={styles.eyebrow}>Diagnosis</Text>
        <Text style={styles.diagnosis}>{r.diagnosis}</Text>
        <View style={styles.confRow}>
          <SeverityPill severity={r.severity} />
          <View style={styles.bar} accessibilityLabel={`${pct}% sure`}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.caption}>{pct}% sure</Text>
        </View>
        {!r.urgent && r.immediate_action && !/^nothing urgent/i.test(r.immediate_action) ? (
          <Text style={styles.body}>
            <Text style={styles.strong}>Right now: </Text>
            {r.immediate_action}
          </Text>
        ) : null}
      </Card>

      {r.confidence < 0.6 && r.question_if_unsure ? (
        <Card style={[styles.block, { backgroundColor: colors.accentSoft, marginTop: spacing.md }]}>
          <View style={styles.rowCenter}>
            <IconTile icon="help" size={40} bg={colors.surface} color={colors.accentDeep} />
            <Text style={[styles.blockTitle, { flex: 1 }]}>One question</Text>
          </View>
          <Text style={styles.body}>{r.question_if_unsure}</Text>
          <Text style={styles.caption}>Retake the photo with that detail, or call a specialist.</Text>
        </Card>
      ) : null}

      {r.route === "diy" ? <Diy r={r} /> : null}
      {r.route === "specialist" ? <SpecialistCard trade={r.specialist_trade} /> : null}
      {r.route === "manager" ? <ManagerCard id={result.id} initial={result.status ?? "sent"} /> : null}
      {r.route === "neighbor" ? <NeighborCard r={r} /> : null}

      <View style={styles.notes}>
        {r.safety_notes.map((n) => (
          <View key={n} style={styles.noteRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[styles.caption, { flex: 1 }]}>{n}</Text>
          </View>
        ))}
        <Text style={styles.caption}>{r.responsibility_note}</Text>
      </View>

      <Button
        title="Report another problem"
        icon="camera"
        variant="secondary"
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          resetFlow();
          router.dismissAll();
        }}
      />
    </ScreenWrapper>
  );
}

function Diy({ r }: { r: TriageResult }) {
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    if (!r.materials.length) return;
    (async () => {
      let pos: { latitude: number; longitude: number } | null = null;
      try {
        pos = await getCurrentLocation();
      } catch {}
      try {
        setStores(await fetchStores(pos?.latitude, pos?.longitude));
      } catch {}
    })();
  }, [r.materials.length]);

  return (
    <>
      <SectionTitle>Steps</SectionTitle>
      <Card style={styles.block}>
        <NumberedSteps steps={r.steps} />
      </Card>

      {r.materials.length ? (
        <>
          <SectionTitle>What to buy</SectionTitle>
          <Card style={styles.block}>
            {r.materials.map((m, i) => (
              <View key={m.name} style={[styles.material, i > 0 && styles.hairline]}>
                <IconTile icon="cube" size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.blockTitle}>{m.name}</Text>
                  <Text style={styles.caption}>{m.spec}</Text>
                  {m.measure_first ? (
                    <View style={{ marginTop: 4 }}>
                      <Tag label="Measure first" icon="resize" bg={colors.accentSoft} color={colors.accentDeep} />
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
          {stores.length ? (
            <>
              <SectionTitle>Nearest stores</SectionTitle>
              {stores.map((s) => {
                const open = () => Linking.openURL(`${s.product_search_url}${encodeURIComponent(r.materials[0].name)}`);
                return (
                  <Card key={s.id} style={styles.rowCard} onPress={open}>
                    <IconTile icon="storefront" size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockTitle}>{s.name}</Text>
                      {s.distance_km != null ? <Text style={styles.caption}>{s.distance_km} km away</Text> : null}
                    </View>
                    <RowAction icon="search" label={`Search ${s.name}`} />
                  </Card>
                );
              })}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function SpecialistCard({ trade }: { trade: string }) {
  const [list, setList] = useState<Specialist[] | null>(null);

  useEffect(() => {
    fetchSpecialists(trade).then(setList).catch(() => setList([]));
  }, [trade]);

  return (
    <>
      <SectionTitle>{`Nearby ${trade}s`}</SectionTitle>
      {(list ?? []).map((s) => (
        <Card key={s.id} style={styles.rowCard} onPress={() => Linking.openURL(`tel:${s.phone.replace(/\s/g, "")}`)}>
          <IconTile icon="person" size={44} bg={routeColors.specialist.tint} color={routeColors.specialist.solid} />
          <View style={{ flex: 1 }}>
            <Text style={styles.blockTitle}>{s.name}</Text>
            <Text style={styles.caption}>
              {s.area} · {s.phone}
            </Text>
          </View>
          <RowAction icon="call" label={`Call ${s.name}`} />
        </Card>
      ))}
      {list && !list.length ? <Text style={styles.body}>No specialists found for this trade yet.</Text> : null}
      <Text style={styles.caption}>Sample contacts for the demo area. Not a verified list.</Text>
    </>
  );
}

const STATUS_TEXT: Record<ReportStatus, string> = {
  new: "Your report is saved.",
  sent: "Your building manager can see it now. The status updates here as they pick it up.",
  in_progress: "Your building manager is working on it.",
  fixed: "Your building manager marked this as fixed. Thank you for reporting it!",
};

// Live status: polls the report while the resident keeps this screen open
function ManagerCard({ id, initial }: { id: string | null; initial: ReportStatus }) {
  const [status, setStatus] = useState<ReportStatus>(initial);
  const lastStatus = useRef(initial);

  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      fetchReport(id)
        .then((rep) => {
          if (rep.status !== lastStatus.current) notify(`Status: ${STATUS_LABEL[rep.status]}`);
          lastStatus.current = rep.status;
          setStatus(rep.status);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [id]);

  if (!id) {
    return (
      <Card style={[styles.block, { marginTop: spacing.lg }]}>
        <Text style={styles.blockTitle}>Sample result</Text>
        <Text style={styles.body}>A real report is sent to your building manager with your photo.</Text>
      </Card>
    );
  }

  return (
    <Card style={[styles.block, { marginTop: spacing.lg }]}>
      <View style={styles.rowCenter}>
        <IconTile
          icon={status === "fixed" ? "checkmark-done" : "checkmark"}
          size={40}
          bg={colors.successSoft}
          color={colors.success}
        />
        <Text style={[styles.blockTitle, { flex: 1 }]}>Report sent with your photo</Text>
        <StatusPill status={status} />
      </View>
      <Text style={styles.body}>{STATUS_TEXT[status]}</Text>
    </Card>
  );
}

function NeighborCard({ r }: { r: TriageResult }) {
  return (
    <>
      <SectionTitle>Document the damage</SectionTitle>
      <Card style={styles.block}>
        <NumberedSteps steps={r.steps} />
      </Card>
      {r.neighbor_message ? (
        <>
          <SectionTitle>Message to your neighbour</SectionTitle>
          <Card style={styles.block}>
            <Text selectable style={styles.body}>
              {r.neighbor_message}
            </Text>
          </Card>
          <Button
            title="Share message"
            icon="share-outline"
            variant="secondary"
            style={{ marginTop: spacing.md }}
            onPress={() => Share.share({ message: r.neighbor_message! }).catch(() => notify("Could not share", "error"))}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing.sm },
  heroTitle: { ...typography.h1, color: colors.ink },
  heroBody: { ...typography.body, color: colors.ink },
  diagCard: { marginTop: spacing.md, gap: spacing.sm, padding: spacing.lg },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted },
  diagnosis: { ...typography.h2, color: colors.ink },
  confRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  block: { gap: spacing.sm },
  blockTitle: { ...typography.h3, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  strong: { fontFamily: typography.label.fontFamily },
  caption: { ...typography.caption, color: colors.textMuted },
  material: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingTop: spacing.xs },
  hairline: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.xs },
  rowCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  notes: { gap: spacing.sm, marginTop: spacing.xl },
  noteRow: { flexDirection: "row", gap: spacing.sm },
});
