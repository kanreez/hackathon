import { getLang } from "../i18n";
import { Coords } from "../utils/location";
import { api } from "./api";

// Address lookups for the listing form. They go through our server (one queue and cache for
// OpenStreetMap's Nominatim), never straight to Nominatim. `unavailable` means the lookup
// service is down: the host can still tap the map.
export type GeoPlace = {
  label: string; // "ул. Цар Самуил 110, Лагера"
  address: string | null;
  district: string | null;
  city: string | null; // a CITIES name, if the place is in one
  latitude: number;
  longitude: number;
};

export async function searchAddress(q: string, city: string) {
  const params = new URLSearchParams({ q, city, lang: getLang() });
  return api.get<{ results: GeoPlace[]; unavailable?: boolean }>(`/api/geo/search?${params}`);
}

export async function reverseGeocode(coords: Coords) {
  const params = new URLSearchParams({ lat: String(coords.latitude), lng: String(coords.longitude), lang: getLang() });
  return api.get<{ result: GeoPlace | null; unavailable?: boolean }>(`/api/geo/reverse?${params}`);
}
