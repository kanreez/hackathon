import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AvailabilityEditor } from "../../components/AvailabilityEditor";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { LocationPicker } from "../../components/map/LocationPicker";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { ACCESS_META, AREA_CENTERS, AREAS, SIZE_META } from "../../constants/garages";
import { colors, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { createGarage, getGarage, updateGarage } from "../../services/garages";
import { Access, AvailabilityWindow, Garage, GarageInput, GarageSize } from "../../types/garage";
import { Coords } from "../../utils/location";
import { goBack } from "../../utils/navigation";

const AREA_OPTIONS = AREAS.map((a) => ({ value: a, label: a }));
const SIZE_OPTIONS = (Object.keys(SIZE_META) as GarageSize[]).map((s) => ({ value: s, label: `${SIZE_META[s].label} · ${SIZE_META[s].hint}` }));
const COVER_OPTIONS = [
  { value: "covered", label: "Covered" },
  { value: "open", label: "Open-air" },
] as const;
const ACCESS_OPTIONS = (Object.keys(ACCESS_META) as Access[]).map((a) => ({ value: a, label: ACCESS_META[a].label }));

const toNumber = (s: string) => Number(s.replace(",", "."));

type Area = (typeof AREAS)[number];
const isArea = (a: string): a is Area => (AREAS as readonly string[]).includes(a);

// Host side: list a garage, or edit one with ?id=. No photo upload, only an optional image link.
export default function GarageFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading, error, reload } = useAsync(() => (id ? getGarage(id) : Promise.resolve(null)), [id]);

  if (!id) return <GarageForm />;
  if (loading || error || !data) {
    return (
      <ScreenWrapper>
        <Header eyebrow="Host" title="Edit garage" back backTo="/host" />
        {loading ? <Loading /> : <ErrorState message={error ?? "Garage not found"} onRetry={reload} />}
      </ScreenWrapper>
    );
  }
  return <GarageForm garage={data.garage} />;
}

function GarageForm({ garage }: { garage?: Garage }) {
  const [title, setTitle] = useState(garage?.title ?? "");
  const [area, setArea] = useState<Area>(garage && isArea(garage.area) ? garage.area : AREAS[0]);
  const [address, setAddress] = useState(garage?.address ?? "");
  const [coords, setCoords] = useState<Coords | null>(
    garage?.latitude != null && garage.longitude != null ? { latitude: garage.latitude, longitude: garage.longitude } : null
  );
  const [size, setSize] = useState<GarageSize>(garage?.size ?? "medium");
  const [cover, setCover] = useState<"covered" | "open">(garage && !garage.covered ? "open" : "covered");
  const [priceHour, setPriceHour] = useState(garage ? String(garage.price_hour) : "");
  const [priceDay, setPriceDay] = useState(garage ? String(garage.price_day) : "");
  const [access, setAccess] = useState<Access>(garage?.access ?? "app");
  const [imageUrl, setImageUrl] = useState(garage?.image_url ?? "");
  const [description, setDescription] = useState(garage?.description ?? "");
  const [availability, setAvailability] = useState<AvailabilityWindow[] | null>(garage?.availability ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give it a short name renters will recognise.";
    if (!(toNumber(priceHour) > 0)) next.priceHour = "Enter a price, like 3 or 2.50.";
    if (!(toNumber(priceDay) > 0)) next.priceDay = "Enter a price, like 20.";
    if (imageUrl.trim() && !/^https?:\/\//.test(imageUrl.trim())) next.imageUrl = "Paste a link starting with https://";
    if (availability && !availability.length) next.availability = "Turn on at least one day, or choose Any time.";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const input: GarageInput = {
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
        description: description.trim() || null,
        availability,
      };
      if (garage) {
        await updateGarage(garage.id, input);
        notify("Changes saved");
      } else {
        await createGarage(input);
        notify(access === "app" ? "Listed. Now pair the door's device." : "Garage listed");
      }
      goBack("/host");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header eyebrow="Host" title={garage ? "Edit garage" : "List a garage"} back backTo="/host" />

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>Where</Text>
        <Input label="Title" placeholder="Covered garage by Pirogov" value={title} onChangeText={setTitle} error={errors.title} />
        <Field label="Area">
          <ChipRow options={AREA_OPTIONS} value={area} onChange={setArea} />
        </Field>
        <Input label="Address" placeholder="ul. Tsar Samuil 110" value={address} onChangeText={setAddress} />
        <Field label="Location on the map">
          <LocationPicker value={coords} onChange={setCoords} fallbackCenter={AREA_CENTERS[area]} />
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
        <Input
          label="Description (optional)"
          placeholder="2.1 m high door, fits a roof box. Charger socket inside."
          multiline
          maxLength={500}
          value={description}
          onChangeText={setDescription}
          hint={`${description.length}/500`}
          style={{ minHeight: 84 }}
        />
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>{"When it's free"}</Text>
        <AvailabilityEditor value={availability} onChange={setAvailability} error={errors.availability} />
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

      <Button title={garage ? "Save changes" : "List garage"} icon="checkmark" variant="accent" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
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
