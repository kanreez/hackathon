import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AvailabilityEditor } from "../../components/AvailabilityEditor";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChipRow } from "../../components/Chip";
import { CityPicker } from "../../components/CityPicker";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { LocationPicker, MapFocus } from "../../components/map/LocationPicker";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { ErrorState, Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { ACCESS_META, AREA_CENTERS, areaLabel, AREAS, cityByName, cityCenter, cityLabel, DEFAULT_CITY, SIZE_META } from "../../constants/garages";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAsync } from "../../hooks/useAsync";
import { t, useT } from "../../i18n";
import { createGarage, getGarage, updateGarage } from "../../services/garages";
import { GeoPlace, reverseGeocode, searchAddress } from "../../services/geo";
import { Access, AvailabilityWindow, Garage, GarageInput, GarageSize } from "../../types/garage";
import { Coords, distanceKm } from "../../utils/location";
import { goBack } from "../../utils/navigation";

const CITY_ZOOM = 13; // the whole city
const DISTRICT_ZOOM = 15; // a Sofia district
const STREET_ZOOM = 17; // a found address or your own location
const FAR_KM = 30; // a pin further than this from the city's centre gets a warning

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

const pinOf = (g?: Garage): Coords | null =>
  g?.latitude != null && g.longitude != null ? { latitude: g.latitude, longitude: g.longitude } : null;

function GarageForm({ garage }: { garage?: Garage }) {
  useT();
  const [title, setTitle] = useState(garage?.title ?? "");
  const [city, setCity] = useState(garage?.city && cityByName(garage.city) ? garage.city : DEFAULT_CITY);
  const inSofia = city === DEFAULT_CITY;
  // Sofia: one of the five known districts. Elsewhere: free text, optional (stored as the city if blank).
  const [area, setArea] = useState<Area>(garage && isArea(garage.area) ? garage.area : AREAS[0]);
  const [district, setDistrict] = useState(garage && garage.city && garage.city !== DEFAULT_CITY && garage.area !== garage.city ? garage.area : "");
  const [address, setAddress] = useState(garage?.address ?? "");
  const [coords, setCoords] = useState<Coords | null>(pinOf(garage));
  // Where the map looks: the garage's pin, else the city (Sofia: the chosen district)
  const [focus, setFocus] = useState<MapFocus>(() => {
    const pin = pinOf(garage);
    if (pin) return { at: pin, zoom: STREET_ZOOM, id: 0 };
    return inSofia ? { at: AREA_CENTERS[area], zoom: DISTRICT_ZOOM, id: 0 } : { at: cityCenter(city), zoom: CITY_ZOOM, id: 0 };
  });
  const [pinLabel, setPinLabel] = useState<string | null>(garage?.address && pinOf(garage) ? garage.address : null);
  const [geoResults, setGeoResults] = useState<GeoPlace[]>([]);
  const [geoNote, setGeoNote] = useState<"notFound" | "unavailable" | null>(null);
  const [finding, setFinding] = useState(false);
  const [whereTouched, setWhereTouched] = useState(false);
  // What the lookups last filled in, so a later pin move may replace it but never the host's own text
  const autoFilled = useRef({ address: "", district: "" });
  const lookup = useRef(0); // only the latest reverse lookup may fill the fields
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

  const moveMap = (at: Coords, zoom: number) => setFocus((f) => ({ at, zoom, id: f.id + 1 }));

  // Fill Address / District from a lookup, unless the host typed their own
  const fillFrom = (place: GeoPlace) => {
    if (place.address) {
      const next = place.address;
      setAddress((cur) => (!cur.trim() || cur === autoFilled.current.address ? next : cur));
      autoFilled.current.address = next;
    }
    if (place.district && !inSofia) {
      const next = place.district;
      setDistrict((cur) => (!cur.trim() || cur === autoFilled.current.district ? next : cur));
      autoFilled.current.district = next;
    }
  };

  // A pin placed by a tap, a drag or "Use my location": look up the street there
  const placePin = async (at: Coords | null, fromGps = false) => {
    setWhereTouched(true);
    setCoords(at);
    setPinLabel(null);
    setGeoResults([]);
    const ticket = ++lookup.current;
    if (!at) return;
    if (fromGps) moveMap(at, STREET_ZOOM);
    try {
      const { result } = await reverseGeocode(at);
      if (!result || ticket !== lookup.current) return;
      setPinLabel(result.label);
      fillFrom(result);
      // GPS put the pin in another known city: switch to it
      if (fromGps && result.city && result.city !== city && cityByName(result.city)) {
        setCity(result.city);
        notify(t("hostForm.citySet", { city: cityLabel(result.city) }));
      }
    } catch {
      // No street name: the pin itself is what matters
    }
  };

  const changeCity = (name: string) => {
    if (name === city) return;
    setWhereTouched(true);
    setCity(name);
    setGeoResults([]);
    setGeoNote(null);
    if (district === autoFilled.current.district) setDistrict("");
    const center = cityCenter(name);
    moveMap(center, CITY_ZOOM);
    // A pin only stays if it's plausibly in the new city
    if (coords && distanceKm(coords, center) > FAR_KM) {
      lookup.current++;
      setCoords(null);
      setPinLabel(null);
    }
  };

  const changeArea = (next: Area) => {
    setArea(next);
    if (!coords) moveMap(AREA_CENTERS[next], DISTRICT_ZOOM);
  };

  const choose = (place: GeoPlace) => {
    lookup.current++;
    setWhereTouched(true);
    setGeoResults([]);
    setGeoNote(null);
    const at = { latitude: place.latitude, longitude: place.longitude };
    setCoords(at);
    setPinLabel(place.label);
    moveMap(at, STREET_ZOOM);
    if (place.district && !inSofia && !district.trim()) {
      setDistrict(place.district);
      autoFilled.current.district = place.district;
    }
  };

  // "Find on map": one lookup per tap (OpenStreetMap doesn't allow search-as-you-type)
  const find = async () => {
    const q = address.trim();
    if (q.length < 3 || finding) return;
    try {
      setFinding(true);
      setGeoNote(null);
      setGeoResults([]);
      const r = await searchAddress(q, city);
      if (r.unavailable) setGeoNote("unavailable");
      else if (!r.results.length) setGeoNote("notFound");
      else if (r.results.length === 1) choose(r.results[0]);
      else setGeoResults(r.results);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setFinding(false);
    }
  };

  const far = coords ? distanceKm(coords, cityCenter(city)) > FAR_KM : false;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("hostForm.errTitle");
    // New listings need a pin; an old one without a pin only once the host edits where it is
    if (!coords && (!garage || whereTouched)) next.coords = t("hostForm.errPin");
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
        city,
        area: inSofia ? area : district.trim(), // blank: the server uses the city's name
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
        <CityPicker label={t("hostForm.city")} value={city} onChange={changeCity} />
        {inSofia ? (
          <Field label={t("hostForm.area")}>
            <ChipRow options={areaOptions()} value={area} onChange={changeArea} />
          </Field>
        ) : (
          <Input
            label={t("hostForm.district")}
            placeholder={t("hostForm.districtPlaceholder")}
            value={district}
            onChangeText={(v) => {
              setDistrict(v);
              setWhereTouched(true);
            }}
          />
        )}
        <View style={{ gap: spacing.sm }}>
          <Input
            label={t("hostForm.address")}
            placeholder={inSofia ? t("hostForm.addressPlaceholder") : t("hostForm.addressPlaceholderCity")}
            value={address}
            onChangeText={(v) => {
              setAddress(v);
              setGeoNote(null);
            }}
            returnKeyType="search"
            onSubmitEditing={find}
          />
          <Button
            title={t("hostForm.findOnMap")}
            icon="search"
            size="sm"
            variant="secondary"
            loading={finding}
            disabled={address.trim().length < 3}
            onPress={find}
            style={{ alignSelf: "flex-start" }}
          />
          {geoNote ? (
            <Text style={styles.note} accessibilityRole="alert">
              {geoNote === "notFound" ? t("hostForm.addressNotFound", { city: cityLabel(city) }) : t("hostForm.geoUnavailable")}
            </Text>
          ) : null}
          {geoResults.length ? (
            <View style={styles.results}>
              <Text style={styles.label}>{t("hostForm.pickResult")}</Text>
              {geoResults.map((r, i) => (
                <Pressable
                  key={`${r.latitude},${r.longitude},${i}`}
                  accessibilityRole="button"
                  onPress={() => choose(r)}
                  style={({ pressed }) => [styles.result, pressed && { opacity: 0.75 }]}
                >
                  <Ionicons name="location-outline" size={18} color={colors.accentDeep} />
                  <Text style={[styles.body, { flex: 1 }]} numberOfLines={2}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Field label={t("hostForm.location")}>
          <LocationPicker
            value={coords}
            onChange={(c) => placePin(c)}
            onLocate={(c) => placePin(c, true)}
            fallbackCenter={cityCenter(city)}
            focus={focus}
            pinLabel={pinLabel}
          />
          {far ? <Text style={styles.note}>{t("map.farFromCity", { city: cityLabel(city) })}</Text> : null}
          {errors.coords ? <Text style={styles.error}>{errors.coords}</Text> : null}
          <Text style={styles.caption}>{t("map.osmCredit")}</Text>
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
  note: { ...typography.caption, color: colors.cta },
  error: { ...typography.caption, color: colors.errorText },
  results: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.sand },
  result: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  prices: { flexDirection: "row", gap: spacing.sm },
});
