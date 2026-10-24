import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { notify } from "../components/Toast";
import { colors, radius, spacing, typography } from "../constants/theme";
import { STATUS_LABEL, StatusPill } from "../components/StatusPill";
import { fetchReport } from "../services/manager";
import { fetchSpecialists, fetchStores } from "../services/reports";
import { resetFlow, useFlow } from "../state/reportFlow";
import { ReportStatus, Route, Specialist, Store, TriageResult } from "../types/triage";
import { getCurrentLocation } from "../utils/location";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ROUTE_META: Record<Route, { title: string; icon: IconName }> = {
  diy: { title: "You can fix this yourself", icon: "hammer" },
  specialist: { title: "Call a specialist", icon: "call" },
  manager: { title: "Sent to your building manager", icon: "business" },
  neighbor: { title: "Talk to your neighbour above", icon: "chatbubbles" },
};

// Screen 3: result for all four routes
export default function Result() {
  const { result } = useFlow();

  if (!result) {
    // Landed here without a result (e.g. a reload): go back to the start
    return (
      <ScreenWrapper>
        <View style={styles.empty}>
          <Text style={styles.title}>Nothing to show yet</Text>
          <Button title="Report a problem" onPress={() => router.replace("/")} />
        </View>
      </ScreenWrapper>
    );
  }

  const r = result.ai_result;
  const meta = ROUTE_META[r.route];

  return (
    <ScreenWrapper scroll>
      {r.urgent ? (
        <View style={styles.urgent}>
          <Ionicons name="warning" size={22} color={colors.white} />
          <Text style={styles.urgentText}>{r.immediate_action}</Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Ionicons name={meta.icon} size={28} color={colors.ink} />
        <Text style={styles.heroTitle}>{meta.title}</Text>
        <Text style={styles.heroBody}>{r.route_reason}</Text>
      </View>

      <Text style={styles.diagnosis}>{r.diagnosis}</Text>
      {!r.urgent && r.immediate_action && !/^nothing urgent/i.test(r.immediate_action) ? (
        <Text style={styles.sub}>Right now: {r.immediate_action}</Text>
      ) : null}

      {r.confidence < 0.6 && r.question_if_unsure ? (
        <Card style={styles.block}>
          <Text style={styles.blockTitle}>One question</Text>
          <Text style={styles.body}>{r.question_if_unsure}</Text>
          <Text style={styles.caption}>Retake the photo with that detail, or call a specialist.</Text>
        </Card>
      ) : null}

      {r.route === "diy" ? <Diy r={r} /> : null}
      {r.route === "specialist" ? <SpecialistCard trade={r.specialist_trade} /> : null}
      {r.route === "manager" ? <ManagerCard id={result.id} initial={result.status ?? "sent"} /> : null}
      {r.route === "neighbor" ? <NeighborCard r={r} /> : null}

      {r.safety_notes.map((n) => (
        <Text key={n} style={styles.caption}>
          {n}
        </Text>
      ))}
      <Text style={[styles.caption, { marginTop: spacing.md }]}>{r.responsibility_note}</Text>

      <Button
        title="Report another problem"
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
      <Text style={styles.section}>Steps</Text>
      <Card style={styles.block}>
        {r.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={[styles.body, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
      </Card>

      {r.materials.length ? (
        <>
          <Text style={styles.section}>What to buy</Text>
          <Card style={styles.block}>
            {r.materials.map((m) => (
              <View key={m.name}>
                <Text style={styles.blockTitle}>{m.name}</Text>
                <Text style={styles.body}>{m.spec}</Text>
                {m.measure_first ? <Text style={styles.measure}>Measure first, then buy</Text> : null}
              </View>
            ))}
          </Card>
          {stores.length ? (
            <>
              <Text style={styles.section}>Nearest stores</Text>
              {stores.map((s) => (
                <Card
                  key={s.id}
                  style={styles.rowCard}
                  onPress={() => Linking.openURL(`${s.product_search_url}${encodeURIComponent(r.materials[0].name)}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockTitle}>{s.name}</Text>
                    {s.distance_km != null ? <Text style={styles.caption}>{s.distance_km} km away</Text> : null}
                  </View>
                  <Ionicons name="search" size={20} color={colors.ink} />
                </Card>
              ))}
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
      <Text style={styles.section}>Nearby {trade}s</Text>
      {(list ?? []).map((s) => (
        <Card key={s.id} style={styles.rowCard} onPress={() => Linking.openURL(`tel:${s.phone.replace(/\s/g, "")}`)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.blockTitle}>{s.name}</Text>
            <Text style={styles.caption}>
              {s.area} · {s.phone}
            </Text>
          </View>
          <Ionicons name="call" size={20} color={colors.ink} />
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
        <Ionicons
          name={status === "fixed" ? "checkmark-done-circle" : "checkmark-circle"}
          size={22}
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
      <Text style={styles.section}>Document the damage</Text>
      <Card style={styles.block}>
        {r.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={[styles.body, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
      </Card>
      {r.neighbor_message ? (
        <>
          <Text style={styles.section}>Message to your neighbour</Text>
          <Card style={styles.block}>
            <Text selectable style={styles.body}>
              {r.neighbor_message}
            </Text>
          </Card>
          <Button
            title="Share message"
            icon="share-outline"
            variant="secondary"
            onPress={() => Share.share({ message: r.neighbor_message! }).catch(() => notify("Could not share", "error"))}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: "center", gap: spacing.md },
  title: { ...typography.h1, color: colors.ink },
  urgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  urgentText: { ...typography.h3, color: colors.white, flex: 1 },
  hero: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  heroTitle: { ...typography.h1, color: colors.ink },
  heroBody: { ...typography.body, color: colors.ink, opacity: 0.8 },
  diagnosis: { ...typography.h2, color: colors.ink, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  block: { gap: spacing.sm, marginTop: spacing.sm },
  blockTitle: { ...typography.h3, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  measure: { ...typography.label, color: colors.error, marginTop: 2 },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: { ...typography.h3, color: colors.textMuted, width: 20 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
