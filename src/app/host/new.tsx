import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { notify } from "../../components/Toast";
import { ACCESS_META, AREAS, SIZE_META } from "../../constants/garages";
import { colors, spacing, typography } from "../../constants/theme";
import { createGarage } from "../../services/garages";
import { Access, GarageSize } from "../../types/garage";
import { Coords, getCurrentLocation } from "../../utils/location";

const AREA_OPTIONS = AREAS.map((a) => ({ value: a, label: a }));
const SIZE_OPTIONS = (Object.keys(SIZE_META) as GarageSize[]).map((s) => ({ value: s, label: `${SIZE_META[s].label} · ${SIZE_META[s].hint}` }));
const COVER_OPTIONS = [
  { value: "covered", label: "Covered" },
  { value: "open", label: "Open-air" },
] as const;
const ACCESS_OPTIONS = (Object.keys(ACCESS_META) as Access[]).map((a) => ({ value: a, label: ACCESS_META[a].label }));

const toNumber = (s: string) => Number(s.replace(",", "."));

// Host side: list a garage. No photo upload, only an optional image link.
export default function NewGarage() {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<(typeof AREAS)[number]>(AREAS[0]);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [size, setSize] = useState<GarageSize>("medium");
  const [cover, setCover] = useState<"covered" | "open">("covered");
  const [priceHour, setPriceHour] = useState("");
  const [priceDay, setPriceDay] = useState("");
  const [access, setAccess] = useState<Access>("app");
  const [imageUrl, setImageUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const locate = async () => {
    try {
      setCoords(await getCurrentLocation());
      notify("Location added");
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give it a short name renters will recognise.";
    if (!(toNumber(priceHour) > 0)) next.priceHour = "Enter a price, like 3 or 2.50.";
    if (!(toNumber(priceDay) > 0)) next.priceDay = "Enter a price, like 20.";
    if (imageUrl.trim() && !/^https?:\/\//.test(imageUrl.trim())) next.imageUrl = "Paste a link starting with https://";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await createGarage({
        title: title.trim(),
        area,
        address: address.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        size,
        covered: cover === "covered",
        price_hour: toNumber(priceHour),
        price_day: toNumber(priceDay),
        access,
        image_url: imageUrl.trim() || null,
      });
      notify(access === "app" ? "Listed. Now pair the door's device." : "Garage listed");
      router.back();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header eyebrow="Host" title="List a garage" back />

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>Where</Text>
        <Input label="Title" placeholder="Covered garage by Pirogov" value={title} onChangeText={setTitle} error={errors.title} />
        <Field label="Area">
          <ChipRow options={AREA_OPTIONS} value={area} onChange={setArea} />
        </Field>
        <Input label="Address" placeholder="ul. Tsar Samuil 110" value={address} onChangeText={setAddress} />
        <Field label="Location on the map">
          {coords ? (
            <View style={styles.row}>
              <Text style={styles.body}>
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </Text>
              <Button title="Remove" size="sm" variant="ghost" onPress={() => setCoords(null)} />
            </View>
          ) : (
            <Button title="Use my location" icon="locate" size="sm" variant="secondary" onPress={locate} style={{ alignSelf: "flex-start" }} />
          )}
          <Text style={styles.caption}>Stand at the garage and tap this, so renters see the right distance.</Text>
        </Field>
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>The garage</Text>
        <Field label="Size">
          <ChipRow options={SIZE_OPTIONS} value={size} onChange={setSize} />
        </Field>
        <Field label="Type">
          <ChipRow options={COVER_OPTIONS} value={cover} onChange={setCover} />
        </Field>
        <Input
          label="Image link (optional)"
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          value={imageUrl}
          onChangeText={setImageUrl}
          error={errors.imageUrl}
        />
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>Price and access</Text>
        <View style={styles.prices}>
          <View style={{ flex: 1 }}>
            <Input label="€ per hour" placeholder="3" keyboardType="decimal-pad" value={priceHour} onChangeText={setPriceHour} error={errors.priceHour} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="€ per day" placeholder="20" keyboardType="decimal-pad" value={priceDay} onChangeText={setPriceDay} error={errors.priceDay} />
          </View>
        </View>
        <Field label="How renters get in">
          <ChipRow options={ACCESS_OPTIONS} value={access} onChange={setAccess} />
          <Text style={styles.caption}>
            {access === "app"
              ? "An ESP32 on your door opens it when a renter with an active booking taps Open. You'll get its device key next."
              : ACCESS_META.manual.hint}
          </Text>
        </Field>
      </Card>

      <Button title="List garage" icon="checkmark" variant="accent" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
    </ScreenWrapper>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 640, width: "100%", alignSelf: "center" },
  group: { gap: spacing.md, padding: spacing.lg, marginBottom: spacing.md },
  groupTitle: { ...typography.h3, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  prices: { flexDirection: "row", gap: spacing.sm },
});
