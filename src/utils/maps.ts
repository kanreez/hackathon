import { Linking } from "react-native";
import { t } from "../i18n";
import { notify } from "../components/Toast";
import { Garage } from "../types/garage";

// Every area in server/garages.js AREAS is in Sofia; used when a garage has no coordinates
const CITY = "Sofia";

type Place = Pick<Garage, "latitude" | "longitude" | "address" | "title" | "area">;

const validCoords = (lat: number | null, lng: number | null): lat is number =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat!) <= 90 && Math.abs(lng!) <= 180;

export function directionsUrl(g: Place) {
  const destination = validCoords(g.latitude, g.longitude)
    ? `${g.latitude},${g.longitude}`
    : [g.address ?? g.title, g.area, CITY].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

// Turn-by-turn stays in Google Maps; we only hand over the destination
export async function openDirections(g: Place) {
  try {
    await Linking.openURL(directionsUrl(g));
  } catch {
    notify(t("err.maps"), "error");
  }
}
