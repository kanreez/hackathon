// Garage domain rules shared by the endpoints: sizes, areas, free hours and the AI search prompt.
// Prices live in payments/pricing.js.
// The server is the only authority on prices and on whether a booking is active.

const SIZES = ["small", "medium", "large"]; // small = city car, medium = Golf / sedan, large = SUV / van
const ACCESS = ["app", "manual"];
const BOOKING_MODES = ["hour", "day"];

const HOUR_MS = 3600000;

// Sofia areas the seed data and the AI search know about, with a centre point for sorting
const AREAS = [
  { name: "Lagera", near: "Pirogov hospital, Hristo Botev blvd", latitude: 42.6866, longitude: 23.3005 },
  { name: "Krasno Selo", near: "Tsar Boris III blvd, Hladilnika side", latitude: 42.6809, longitude: 23.2895 },
  { name: "Lozenets", near: "Cherni Vrah blvd, South Park", latitude: 42.6735, longitude: 23.3245 },
  { name: "Center", near: "NDK, Vitosha blvd, Serdika", latitude: 42.6935, longitude: 23.3219 },
  { name: "Mladost", near: "Business Park Sofia, Tsarigradsko shose", latitude: 42.6494, longitude: 23.3792 },
];

// A garage fits a vehicle when it is at least that size
const fits = (garageSize, vehicleSize) => !vehicleSize || SIZES.indexOf(garageSize) >= SIZES.indexOf(vehicleSize);

const overlaps = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

// Every area is in Sofia, so availability hours are Sofia wall-clock time
const GARAGE_TZ = "Europe/Sofia";
const DESCRIPTION_MAX = 500;

// Host input -> null (free any time) or a clean list of weekly windows
// [{ day: 0-6 (0 = Sunday), start: 0-23, end: 1-24 }], at most one per day, sorted.
// Returns { error } when the input is not usable.
function normalizeAvailability(input) {
  if (input == null) return { availability: null };
  if (!Array.isArray(input)) return { error: "availability must be a list of weekly hours" };
  const byDay = new Map();
  for (const w of input) {
    const day = Number(w?.day);
    const start = Number(w?.start);
    const end = Number(w?.end);
    if (![day, start, end].every(Number.isInteger) || day < 0 || day > 6 || start < 0 || end > 24 || end <= start) {
      return { error: "each availability window needs a day 0-6 and whole hours with start before end" };
    }
    if (byDay.has(day)) return { error: "availability can have one window per day" };
    byDay.set(day, { day, start, end });
  }
  if (!byDay.size) return { error: "pick at least one day the garage is free, or make it free any time" };
  return { availability: [...byDay.values()].sort((a, b) => a.day - b.day) };
}

const sofiaClock = new Intl.DateTimeFormat("en-US", { timeZone: GARAGE_TZ, weekday: "short", hour: "numeric", hourCycle: "h23" });
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Is the garage free for every hour of [start, end)? Bookings are whole hours, so checking
// the start of each hour is enough. Mirrors isAvailable in src/utils/availability.ts.
function isAvailable(garage, start, end) {
  const windows = garage.availability;
  if (!windows) return true;
  const endMs = new Date(end).getTime();
  for (let t = new Date(start).getTime(); t < endMs; t += HOUR_MS) {
    const parts = Object.fromEntries(sofiaClock.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    const day = WEEKDAY_INDEX[parts.weekday];
    const hour = Number(parts.hour);
    if (!windows.some((w) => w.day === day && hour >= w.start && hour < w.end)) return false;
  }
  return true;
}

// The renter's copy of a garage: never includes the device secret
function publicGarage(g) {
  const { device_key: _key, ...rest } = g;
  return rest;
}

// Gemini-style schema (converted for Claude in anthropic.js)
const SEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    area: { type: "STRING", enum: AREAS.map((a) => a.name), nullable: true },
    from: { type: "STRING", nullable: true },
    to: { type: "STRING", nullable: true },
    vehicle_size: { type: "STRING", enum: SIZES, nullable: true },
    covered: { type: "BOOLEAN", nullable: true },
  },
  required: ["area", "from", "to", "vehicle_size", "covered"],
};

const SEARCH_SYSTEM = [
  "You turn a renter's plain-language garage request in Sofia, Bulgaria into search filters.",
  "The request may be in English or Bulgarian.",
  "Only fill a filter the request actually implies; otherwise use null. Never invent details.",
].join(" ");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildSearchPrompt(query, nowLocal) {
  const areas = AREAS.map((a) => `- ${a.name} (landmarks: ${a.near})`).join("\n");
  const weekday = WEEKDAYS[new Date(`${nowLocal.slice(0, 10)}T12:00:00Z`).getUTCDay()];
  return [
    `Now (renter's local time): ${weekday} ${nowLocal}.`,
    "",
    "Known areas:",
    areas,
    "",
    "Rules:",
    "- area: the known area that matches the place or landmark in the request, or null.",
    '- from / to: local times as "YYYY-MM-DDTHH:mm", whole hours. "tomorrow 9 to 13" means tomorrow 09:00 to 13:00.',
    "  A date with no hours means the whole day (00:00 to 00:00 the next day). No time at all: both null.",
    "  A weekday name means the next such day, or today if today is that day and the time hasn't passed.",
    "  Never return a time range that has already ended.",
    "- vehicle_size: small = city car (Fiat 500, Yaris), medium = compact or sedan (Golf, Octavia), large = SUV or van.",
    "- covered: true if they ask for an indoor or covered garage, false if they say open-air is fine, otherwise null.",
    "",
    `Request: ${JSON.stringify(String(query).slice(0, 300))}`,
  ].join("\n");
}

// Minutes to add to local time to get UTC at instant `ms` in an IANA zone (same sign as
// Date#getTimezoneOffset). Null if the zone is unknown.
function zoneOffsetAt(ms, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
    }).formatToParts(new Date(ms));
    const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
    return (Math.floor(ms / 60000) * 60000 - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)) / 60000;
  } catch {
    return null;
  }
}

// "YYYY-MM-DDTHH:mm" in the renter's local time -> ISO in UTC. Uses the renter's IANA zone so
// a date on the other side of a DST change gets its own offset; falls back to offsetMin
// (Date#getTimezoneOffset() at request time) when the zone is missing.
function localToUtc(local, offsetMin, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local || "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let offset = timeZone ? zoneOffsetAt(asUtc, timeZone) : null;
  if (offset === null) return new Date(asUtc + offsetMin * 60000).toISOString();
  // Re-check at the corrected instant in case the guess landed across the DST switch
  offset = zoneOffsetAt(asUtc + offset * 60000, timeZone) ?? offset;
  return new Date(asUtc + offset * 60000).toISOString();
}

module.exports = {
  SIZES,
  ACCESS,
  BOOKING_MODES,
  AREAS,
  HOUR_MS,
  fits,
  overlaps,
  GARAGE_TZ,
  DESCRIPTION_MAX,
  normalizeAvailability,
  isAvailable,
  publicGarage,
  SEARCH_SCHEMA,
  SEARCH_SYSTEM,
  buildSearchPrompt,
  localToUtc,
};
