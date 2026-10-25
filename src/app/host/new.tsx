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
import { ACCESS_META, AREA_CENTERS, areaLabel, AREAS, SIZE_META } from "../../constants/garages";
import { colors, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { t, useT } from "../../i18n";
import { createGarage, getGarage, updateGarage } from "../../services/garages";
import { Access, AvailabilityWindow, Garage, GarageInput, GarageSize } from "../../types/garage";
import { Coords } from "../../utils/location";
import { goBack } from "../../utils/navigation";

// Built during render, so the labels follow the app language
const areaOptions = () => AREAS.map((a) => ({ value: a, label: areaLabel(a) }));
const sizeOptions = () => (Object.keys(SIZE_META) as GarageSize[]).map((s) => ({ value: s, label: `${SIZE_META[s].label}, ${SIZE_META[s].hint.toLowerCase()}` }));
const coverOptions = () => [
  { value: "covered" as const, label: t("garage.covered") },
  { value: "open" as const, label: t("garage.openAir") },
];
const accessOptions = () => (Object.keys(ACCESS_META) as Access[]).map((a) => ({ value: a, label: ACCESS_META[a].label }));

const toNumber = (s: string) => Number(s.replace(",", "."));

type Area = (typeof AREAS)[number];
const isArea = (a: string): a is Area => (AREAS as readonly string[]).includes(a);

// Host side: list a garage, or edit one with ?id=. No photo upload, only an optional image link.
export default function GarageFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  useT();
  const { data, loading, error, reload } = useAsync(() => (id ? getGarage(id) : Promise.resolve(null)), [id]);

  if (!id) return <GarageForm />;
  if (loading || error || !data) {
    return (
      <ScreenWrapper>
        <Header eyebrow={t("host.eyebrow")} title={t("host.edit")} back backTo="/host" />
        {loading ? <Loading /> : <ErrorState message={error ?? t("err.garageNotFound")} onRetry={reload} />}
      </ScreenWrapper>
    );
  }
  return <GarageForm garage={data.garage} />;
}

function GarageForm({ garage }: { garage?: Garage }) {
  useT();
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
    if (!title.trim()) next.title = t("hostForm.errTitle");
    if (!(toNumber(priceHour) > 0)) next.priceHour = t("hostForm.errPriceHour");
    if (!(toNumber(priceDay) > 0)) next.priceDay = t("hostForm.errPriceDay");
    if (imageUrl.trim() && !/^https?:\/\//.test(imageUrl.trim())) next.imageUrl = t("hostForm.errImage");
    if (availability && !availability.length) next.availability = t("hostForm.errAvailability");
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
        notify(t("hostForm.saved"));
      } else {
        await createGarage(input);
        notify(access === "app" ? t("hostForm.listedPair") : t("hostForm.listed"));
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
      <Header eyebrow={t("host.eyebrow")} title={garage ? t("host.edit") : t("host.list")} back backTo="/host" />

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>{t("hostForm.where")}</Text>
        <Input label={t("hostForm.title")} placeholder={t("hostForm.titlePlaceholder")} value={title} onChangeText={setTitle} error={errors.title} />
        <Field label={t("hostForm.area")}>
          <ChipRow options={areaOptions()} value={area} onChange={setArea} />
        </Field>
        <Input label={t("hostForm.address")} placeholder={t("hostForm.addressPlaceholder")} value={address} onChangeText={setAddress} />
        <Field label={t("hostForm.location")}>
          <LocationPicker value={coords} onChange={setCoords} fallbackCenter={AREA_CENTERS[area]} />
        </Field>
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>{t("hostForm.garage")}</Text>
        <Field label={t("book.size")}>
          <ChipRow options={sizeOptions()} value={size} onChange={setSize} />
        </Field>
        <Field label={t("book.type")}>
          <ChipRow options={coverOptions()} value={cover} onChange={setCover} />
        </Field>
        <Input
          label={t("hostForm.image")}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          value={imageUrl}
          onChangeText={setImageUrl}
          error={errors.imageUrl}
        />
        <Input
          label={t("hostForm.description")}
          placeholder={t("hostForm.descriptionPlaceholder")}
          multiline
          maxLength={500}
          value={description}
          onChangeText={setDescription}
          hint={`${description.length}/500`}
          style={{ minHeight: 84 }}
        />
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>{t("hostForm.whenFree")}</Text>
        <AvailabilityEditor value={availability} onChange={setAvailability} error={errors.availability} />
      </Card>

      <Card style={styles.group}>
        <Text style={styles.groupTitle}>{t("hostForm.priceAccess")}</Text>
        <View style={styles.prices}>
          <View style={{ flex: 1 }}>
            <Input label={t("hostForm.perHour")} placeholder="3" keyboardType="decimal-pad" value={priceHour} onChangeText={setPriceHour} error={errors.priceHour} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label={t("hostForm.perDay")} placeholder="20" keyboardType="decimal-pad" value={priceDay} onChangeText={setPriceDay} error={errors.priceDay} />
          </View>
        </View>
        <Field label={t("hostForm.howIn")}>
          <ChipRow options={accessOptions()} value={access} onChange={setAccess} />
          <Text style={styles.caption}>
            {access === "app"
              ? t("hostForm.appHint")
              : ACCESS_META.manual.hint}
          </Text>
        </Field>
      </Card>

      <Button title={garage ? t("review.saveChanges") : t("hostForm.submit")} icon="checkmark" variant="accent" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
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
