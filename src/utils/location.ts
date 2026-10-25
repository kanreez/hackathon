import * as Location from "expo-location";
import { t } from "../i18n";

export type Coords = { latitude: number; longitude: number };

export async function getCurrentLocation(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error(t("err.locationDenied"));

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export async function reverseGeocode(coords: Coords): Promise<string | null> {
  const [place] = await Location.reverseGeocodeAsync(coords);
  if (!place) return null;
  return [place.name, place.city, place.region, place.country].filter(Boolean).join(", ");
}

export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}