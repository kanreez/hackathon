import { getLang, t, tn } from "../i18n";
import { BookingMode, BusySlot, Garage } from "../types/garage";

export const HOUR_MS = 3600000;
export const DAY_MS = 24 * HOUR_MS;

const pad = (n: number) => String(n).padStart(2, "0");

// Local "YYYY-MM-DDTHH:mm", the format the AI search uses
export const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Subtracts instead of setMinutes(0): in the hour repeated when the clocks go back,
// setMinutes(0) jumps to the first 03:00, an hour too early
export const startOfHour = (d: Date) =>
  new Date(d.getTime() - (d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds()));

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addHours = (d: Date, h: number) => new Date(d.getTime() + h * HOUR_MS);

// Calendar days, so a DST change doesn't shift midnight
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Same formula as server/payments/pricing.js: started hours / days are charged in full.
// Display only: the server computes the amount that is actually charged.
export function priceFor(garage: Pick<Garage, "price_hour" | "price_day">, start: Date, end: Date, mode: BookingMode) {
  const hours = (end.getTime() - start.getTime()) / HOUR_MS;
  // The small allowance keeps a 25-hour day at a clock change from counting as two
  if (mode === "day") return Math.max(1, Math.ceil(hours / 24 - 0.05)) * garage.price_day;
  return Math.ceil(hours) * garage.price_hour;
}

// "€8.50" in English, "8,50 €" in Bulgarian
export function formatMoney(n: number) {
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return getLang() === "bg" ? `${amount.replace(".", ",")} €` : `€${amount}`;
}

// Payments are integer cents: 850 -> "€8.50", 800 -> "€8"
export const formatCents = (cents: number) => formatMoney(cents / 100);

export const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function formatDay(d: Date, now = new Date()) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  // Names from the dictionary, not toLocaleDateString: Android's engine may not have Bulgarian
  const weekday = t("date.weekdaysShort").split(",")[d.getDay()];
  const month = t("date.monthsShort").split(",")[d.getMonth()];
  return `${weekday} ${d.getDate()} ${month}`;
}

// "Today 09:00 – 13:00" or "Sat 31 Oct 00:00 – Sun 1 Nov 00:00"
export function formatRange(startIso: string | Date, endIso: string | Date) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = startOfDay(s).getTime() === startOfDay(e).getTime();
  return sameDay
    ? `${formatDay(s)} ${formatTime(s)} – ${formatTime(e)}`
    : `${formatDay(s)} ${formatTime(s)} – ${formatDay(e)} ${formatTime(e)}`;
}

// "2 h 15 min", "45 min", "3 days"
export function formatDuration(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min >= 48 * 60) return tn("duration.days", Math.round(min / 1440));
  if (min >= 60) return min % 60 ? t("duration.hMin", { h: Math.floor(min / 60), m: min % 60 }) : t("duration.h", { h: Math.floor(min / 60) });
  return t("duration.min", { m: min });
}

export const overlaps = (aStart: Date, aEnd: Date, slot: BusySlot) =>
  aStart < new Date(slot.ends_at) && new Date(slot.starts_at) < aEnd;
