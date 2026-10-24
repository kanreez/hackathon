import { Access, GarageSize } from "../types/garage";

// Same area names as AREAS in server/garages.js (the AI search picks one of these)
export const AREAS = ["Lagera", "Krasno Selo", "Lozenets", "Center", "Mladost"] as const;

// Centre points, same as AREAS in server/garages.js: where the map opens before there's a pin
export const AREA_CENTERS: Record<(typeof AREAS)[number], { latitude: number; longitude: number }> = {
  Lagera: { latitude: 42.6866, longitude: 23.3005 },
  "Krasno Selo": { latitude: 42.6809, longitude: 23.2895 },
  Lozenets: { latitude: 42.6735, longitude: 23.3245 },
  Center: { latitude: 42.6935, longitude: 23.3219 },
  Mladost: { latitude: 42.6494, longitude: 23.3792 },
};

export const SIZE_META: Record<GarageSize, { label: string; hint: string }> = {
  small: { label: "Small", hint: "City car" },
  medium: { label: "Medium", hint: "Golf, sedan" },
  large: { label: "Large", hint: "SUV, van" },
};

export const ACCESS_META: Record<Access, { label: string; hint: string }> = {
  app: { label: "Opens from the app", hint: "Tap Open when your booking starts" },
  manual: { label: "Host lets you in", hint: "The host gives you a key or opens it" },
};

// Tappable examples under the Ask box: good for the demo, and they show what the AI understands
export const EXAMPLE_QUERIES = [
  "near Pirogov tomorrow 9 to 13, fits a Golf",
  "covered garage in Lozenets this weekend for an SUV",
  "гараж в Красно село довечера",
];
