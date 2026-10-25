import { t } from "../i18n";
import { AvailabilityWindow, Garage } from "../types/garage";
import { HOUR_MS } from "./booking";

// Monday first, as people read a week; values are Date#getDay() numbers
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
// Short day names in the current language, indexed like Date#getDay(); call during render
export const dayShort = (day: number) => t("date.weekdaysShort").split(",")[day];

export const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

const windowLabel = (w: AvailabilityWindow) => (w.start === 0 && w.end === 24 ? t("hours.allDay") : `${formatHour(w.start)}–${formatHour(w.end)}`);

// Same rule as isAvailable in server/garages.js (which uses Sofia time; this uses the
// phone's clock, the same one the booking picker uses): every hour of [start, end) must
// fall inside a window. null availability = free any time.
export function isAvailable(garage: Pick<Garage, "availability">, start: Date, end: Date) {
  const windows = garage.availability;
  if (!windows) return true;
  for (let t = start.getTime(); t < end.getTime(); t += HOUR_MS) {
    const d = new Date(t);
    const day = d.getDay();
    const hour = d.getHours();
    if (!windows.some((w) => w.day === day && hour >= w.start && hour < w.end)) return false;
  }
  return true;
}

// "Mon–Fri 08:00–18:00 · Sat–Sun all day", or "Any time"
export function summarizeAvailability(windows: AvailabilityWindow[] | null) {
  if (!windows) return t("hours.anyTime");
  const byDay = new Map(windows.map((w) => [w.day, w]));
  const groups: { first: number; last: number; w: AvailabilityWindow }[] = [];
  for (const day of WEEK) {
    const w = byDay.get(day);
    const prev = groups[groups.length - 1];
    if (!w) continue;
    const adjacent = prev && WEEK.indexOf(prev.last as (typeof WEEK)[number]) === WEEK.indexOf(day) - 1;
    if (adjacent && prev.w.start === w.start && prev.w.end === w.end) prev.last = day;
    else groups.push({ first: day, last: day, w });
  }
  if (!groups.length) return t("hours.notAvailable");
  return groups
    .map((g) => {
      const days = g.first === g.last ? dayShort(g.first) : `${dayShort(g.first)}–${dayShort(g.last)}`;
      return `${days} ${windowLabel(g.w)}`;
    })
    .join(" · ");
}
