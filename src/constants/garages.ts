import { getLang, t } from "../i18n";
import { Access, Garage, GarageSize } from "../types/garage";

// The 27 regional capitals, same as CITIES in server/garages.js. `name` (English) is what's stored
// and sent; cityLabel() shows it in the app language. Centres frame the map at city zoom.
export type City = { name: string; bg: string; latitude: number; longitude: number };
export const CITIES: City[] = [
  { name: "Sofia", bg: "София", latitude: 42.6977, longitude: 23.3219 },
  { name: "Plovdiv", bg: "Пловдив", latitude: 42.1354, longitude: 24.7453 },
  { name: "Varna", bg: "Варна", latitude: 43.2141, longitude: 27.9147 },
  { name: "Burgas", bg: "Бургас", latitude: 42.5048, longitude: 27.4626 },
  { name: "Ruse", bg: "Русе", latitude: 43.8487, longitude: 25.9534 },
  { name: "Stara Zagora", bg: "Стара Загора", latitude: 42.4258, longitude: 25.6345 },
  { name: "Pleven", bg: "Плевен", latitude: 43.4170, longitude: 24.6067 },
  { name: "Sliven", bg: "Сливен", latitude: 42.6817, longitude: 26.3229 },
  { name: "Dobrich", bg: "Добрич", latitude: 43.5726, longitude: 27.8273 },
  { name: "Shumen", bg: "Шумен", latitude: 43.2712, longitude: 26.9361 },
  { name: "Pernik", bg: "Перник", latitude: 42.6052, longitude: 23.0378 },
  { name: "Haskovo", bg: "Хасково", latitude: 41.9344, longitude: 25.5554 },
  { name: "Yambol", bg: "Ямбол", latitude: 42.4842, longitude: 26.5035 },
  { name: "Pazardzhik", bg: "Пазарджик", latitude: 42.1928, longitude: 24.3336 },
  { name: "Blagoevgrad", bg: "Благоевград", latitude: 42.0209, longitude: 23.0943 },
  { name: "Veliko Tarnovo", bg: "Велико Търново", latitude: 43.0757, longitude: 25.6172 },
  { name: "Vratsa", bg: "Враца", latitude: 43.2102, longitude: 23.5529 },
  { name: "Gabrovo", bg: "Габрово", latitude: 42.8742, longitude: 25.3187 },
  { name: "Kyustendil", bg: "Кюстендил", latitude: 42.2839, longitude: 22.6911 },
  { name: "Montana", bg: "Монтана", latitude: 43.4085, longitude: 23.2257 },
  { name: "Lovech", bg: "Ловеч", latitude: 43.1370, longitude: 24.7142 },
  { name: "Silistra", bg: "Силистра", latitude: 44.1171, longitude: 27.2606 },
  { name: "Targovishte", bg: "Търговище", latitude: 43.2512, longitude: 26.5724 },
  { name: "Razgrad", bg: "Разград", latitude: 43.5263, longitude: 26.5242 },
  { name: "Smolyan", bg: "Смолян", latitude: 41.5774, longitude: 24.7011 },
  { name: "Kardzhali", bg: "Кърджали", latitude: 41.6338, longitude: 25.3777 },
  { name: "Vidin", bg: "Видин", latitude: 43.9962, longitude: 22.8679 },
];
export const DEFAULT_CITY = "Sofia";
// Listed first in the city picker; the rest follow alphabetically
export const BIG_CITIES = ["Sofia", "Plovdiv", "Varna", "Burgas"];

export const cityByName = (name: string | null | undefined) => CITIES.find((c) => c.name === name) ?? null;
export const cityLabel = (name: string | null | undefined) => {
  const city = cityByName(name ?? DEFAULT_CITY);
  if (!city) return name ?? "";
  return getLang() === "bg" ? city.bg : city.name;
};
export const cityCenter = (name: string | null | undefined) => {
  const city = cityByName(name) ?? cityByName(DEFAULT_CITY)!;
  return { latitude: city.latitude, longitude: city.longitude };
};

// Where a garage is, for lists and headers: "Лагера" in Sofia, "Център, Пловдив" elsewhere.
// A district left blank is stored as the city's name, so it isn't shown twice.
export function placeLabel(g: Pick<Garage, "area" | "city">) {
  const city = g.city ?? DEFAULT_CITY;
  if (city === DEFAULT_CITY) return areaLabel(g.area);
  if (!g.area || g.area === city) return cityLabel(city);
  return `${areaLabel(g.area)}, ${cityLabel(city)}`;
}

// Same area names as AREAS in server/garages.js (the AI search picks one of these). All in Sofia.
export const AREAS = ["Lagera", "Krasno Selo", "Lozenets", "Center", "Mladost"] as const;

// The names stay as data (the server and the AI search use them); this is how they're shown
const AREA_KEYS = { Lagera: "area.lagera", "Krasno Selo": "area.krasnoSelo", Lozenets: "area.lozenets", Center: "area.center", Mladost: "area.mladost" } as const;
export const areaLabel = (area: string) => (area in AREA_KEYS ? t(AREA_KEYS[area as (typeof AREAS)[number]]) : area);

// Centre points, same as AREAS in server/garages.js: where the map opens before there's a pin
export const AREA_CENTERS: Record<(typeof AREAS)[number], { latitude: number; longitude: number }> = {
  Lagera: { latitude: 42.6866, longitude: 23.3005 },
  "Krasno Selo": { latitude: 42.6809, longitude: 23.2895 },
  Lozenets: { latitude: 42.6735, longitude: 23.3245 },
  Center: { latitude: 42.6935, longitude: 23.3219 },
  Mladost: { latitude: 42.6494, longitude: 23.3792 },
};

// Getters, so SIZE_META.small.label is always in the current language (read it during render)
const sizeMeta = (key: "small" | "medium" | "large") => ({
  get label() { return t(`size.${key}` as const); },
  get hint() { return t(`size.${key}.hint` as const); },
  get fits() { return t(`size.${key}.fits` as const); },
});
export const SIZE_META: Record<GarageSize, { label: string; hint: string; fits: string }> = {
  small: sizeMeta("small"),
  medium: sizeMeta("medium"),
  large: sizeMeta("large"),
};

const accessMeta = (key: Access) => ({
  get label() { return t(`access.${key}` as const); },
  get hint() { return t(`access.${key}.hint` as const); },
});
export const ACCESS_META: Record<Access, { label: string; hint: string }> = {
  app: accessMeta("app"),
  manual: accessMeta("manual"),
};

// Tappable examples under the Ask box, in the app's language: good for the demo, and they
// show what the AI understands. Call during render.
export const exampleQueries = () => [t("examples.1"), t("examples.2"), t("examples.3")];
