import { t } from "../i18n";
import { Access, GarageSize } from "../types/garage";

// Same area names as AREAS in server/garages.js (the AI search picks one of these)
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
