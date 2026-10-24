import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { Header, IconButton } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useRole } from "../../context/RoleContext";
import { useAsync } from "../../hooks/useAsync";
import { fetchContext, saveContext } from "../../services/manager";
import { uploadImage } from "../../services/storage";
import { BuildingContext, Contractor, PastRepair } from "../../types/triage";
import { pickImage, takePhoto } from "../../utils/media";

const TYPES = [
  { value: "panel", label: "Panel" },
  { value: "brick", label: "Brick" },
  { value: "monolith", label: "Monolith" },
] as const;

// Building context the домоуправител enters once; the action plan prompt uses it
export default function Building() {
  const { buildingId } = useRole();
  const { data, loading, error, reload } = useAsync(() => fetchContext(buildingId), [buildingId]);

  return (
    <ScreenWrapper scroll>
      <Header title="Building" subtitle="Enter this once. The AI uses it in every action plan." />
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? "Could not load the building"} onRetry={reload} />
      ) : (
        <ContextForm key={data.building_id} initial={data} />
      )}
    </ScreenWrapper>
  );
}

function ContextForm({ initial }: { initial: BuildingContext }) {
  const { user } = useAuth();
  const [form, setForm] = useState<BuildingContext>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof BuildingContext>(key: K, value: BuildingContext[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setListItem = <K extends "contractors" | "past_repairs">(key: K, i: number, patch: Partial<BuildingContext[K][number]>) =>
    setForm((f) => ({ ...f, [key]: f[key].map((item, j) => (j === i ? { ...item, ...patch } : item)) }));

  const removeListItem = (key: "contractors" | "past_repairs", i: number) =>
    setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));

  const valvePhoto = async (source: "camera" | "library") => {
    if (!user) return;
    try {
      const options = { base64: true, quality: 0.5 };
      const img = source === "camera" ? await takePhoto(options) : await pickImage(options);
      if (!img) return;
      setUploading(true);
      set("valve_photo_url", await uploadImage(img, user.id));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const clean = {
        ...form,
        contractors: form.contractors.filter((c) => c.name.trim()),
        past_repairs: form.past_repairs.filter((r) => r.what.trim()),
      };
      setForm(await saveContext(form.building_id, clean));
      notify("Building context saved");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Input label="Building name" value={form.name ?? ""} onChangeText={(t) => set("name", t)} placeholder="Block 12, entrance B" />
      <Input label="Address" value={form.address ?? ""} onChangeText={(t) => set("address", t)} />
      <Input
        label="Year built"
        value={form.year != null ? String(form.year) : ""}
        onChangeText={(t) => set("year", t ? Number(t.replace(/\D/g, "")) || null : null)}
        keyboardType="number-pad"
        maxLength={4}
      />
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Type</Text>
        <ChipRow
          options={TYPES}
          value={(form.type ?? "panel") as (typeof TYPES)[number]["value"]}
          onChange={(v) => set("type", v)}
        />
      </View>
      <Input
        label="Pipe material"
        value={form.pipe_material ?? ""}
        onChangeText={(t) => set("pipe_material", t)}
        placeholder="Galvanised steel risers, PPR in flats"
      />

      <Text style={styles.section}>Main water valve</Text>
      <Input
        label="Where is it?"
        value={form.valve_location_text ?? ""}
        onChangeText={(t) => set("valve_location_text", t)}
        multiline
      />
      {form.valve_photo_url ? (
        <Image source={{ uri: form.valve_photo_url }} style={styles.photo} contentFit="cover" />
      ) : null}
      <View style={styles.row}>
        <Button title="Take photo" icon="camera" size="sm" variant="secondary" loading={uploading} onPress={() => valvePhoto("camera")} />
        <Button title="Gallery" icon="images" size="sm" variant="secondary" disabled={uploading} onPress={() => valvePhoto("library")} />
        {form.valve_photo_url ? <Button title="Remove" size="sm" variant="ghost" onPress={() => set("valve_photo_url", null)} /> : null}
      </View>

      <Input
        label="Electrical panel location"
        value={form.panel_location_text ?? ""}
        onChangeText={(t) => set("panel_location_text", t)}
        multiline
      />

      <Text style={styles.section}>Trusted contractors</Text>
      {form.contractors.map((c, i) => (
        <Card key={i} style={styles.item}>
          <View style={styles.itemHead}>
            <Text style={styles.itemTitle}>Contractor {i + 1}</Text>
            <IconButton icon="trash-outline" label="Remove contractor" onPress={() => removeListItem("contractors", i)} />
          </View>
          <Input label="Name" value={c.name} onChangeText={(t) => setListItem("contractors", i, { name: t } as Partial<Contractor>)} />
          <Input label="Trade" value={c.trade} onChangeText={(t) => setListItem("contractors", i, { trade: t } as Partial<Contractor>)} placeholder="plumber, glazier…" />
          <Input label="Phone" value={c.phone} keyboardType="phone-pad" onChangeText={(t) => setListItem("contractors", i, { phone: t } as Partial<Contractor>)} />
        </Card>
      ))}
      <Button
        title="Add contractor"
        icon="add"
        size="sm"
        variant="secondary"
        onPress={() => set("contractors", [...form.contractors, { name: "", trade: "", phone: "" }])}
      />

      <Text style={styles.section}>Past repairs</Text>
      {form.past_repairs.map((r, i) => (
        <Card key={i} style={styles.item}>
          <View style={styles.itemHead}>
            <Text style={styles.itemTitle}>Repair {i + 1}</Text>
            <IconButton icon="trash-outline" label="Remove repair" onPress={() => removeListItem("past_repairs", i)} />
          </View>
          <Input label="What was done" value={r.what} onChangeText={(t) => setListItem("past_repairs", i, { what: t } as Partial<PastRepair>)} />
          <Input
            label="Year"
            value={String(r.year ?? "")}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={(t) => setListItem("past_repairs", i, { year: t.replace(/\D/g, "") } as Partial<PastRepair>)}
          />
          <Input label="Contractor" value={r.contractor} onChangeText={(t) => setListItem("past_repairs", i, { contractor: t } as Partial<PastRepair>)} />
        </Card>
      ))}
      <Button
        title="Add past repair"
        icon="add"
        size="sm"
        variant="secondary"
        onPress={() => set("past_repairs", [...form.past_repairs, { year: new Date().getFullYear(), what: "", contractor: "" }])}
      />

      <Button title="Save building context" loading={saving} onPress={save} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  label: { ...typography.label, color: colors.ink },
  section: { ...typography.h2, color: colors.ink, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  photo: { height: 160, borderRadius: radius.lg, backgroundColor: colors.secondary },
  item: { gap: spacing.sm, backgroundColor: colors.secondary },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemTitle: { ...typography.h3, color: colors.ink },
});
