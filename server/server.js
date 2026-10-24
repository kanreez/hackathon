const path = require("path");
// Load server/.env no matter which folder the server is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { askAnthropic } = require("./anthropic");
const G = require("./garages");
const { createRepo } = require("./repo");

const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing ${missing.join(", ")}. Copy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.warn("No AI key set: add ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to server/.env for /api/ai.");
}

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const repo = createRepo(supabase);

app.use(cors());
app.use(express.json());

// Verifies the Supabase access token sent by the app
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

  req.user = data.user;
  next();
}

// Verifies the ESP32's secret: it only ever sees commands for its own garage
async function requireDevice(req, res, next) {
  try {
    const garage = await repo.getGarageByDeviceKey(req.headers["x-device-key"]);
    if (!garage) return res.status(401).json({ error: "Unknown device key" });
    req.garage = garage;
    deviceLastSeen.set(garage.id, new Date().toISOString());
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Wraps a route so thrown errors become a 500 with the message
const route = (fn) => (req, res) => fn(req, res).catch((err) => res.status(500).json({ error: err.message }));

app.get("/", (_req, res) => res.json({ status: "ok" }));

app.get("/api/me", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: data });
});

// ==========================================
// AI endpoint: Anthropic (Claude), OpenAI (ChatGPT) or Google Gemini
// ==========================================
// Pick the provider in server/.env:  AI_PROVIDER=anthropic, openai or gemini
// Body: { prompt, system?, json? }
//   system: optional instructions (role, tone, rules)
//   json:   true -> the model must answer with valid JSON (reply is still a string; parse it in the app)
const AI_PROVIDER = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "gemini")).toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Optional second Gemini model, tried when the main one is overloaded
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const MODEL_BY_PROVIDER = { anthropic: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", openai: OPENAI_MODEL, gemini: GEMINI_MODEL };
console.log(`AI provider: ${AI_PROVIDER} (${MODEL_BY_PROVIDER[AI_PROVIDER]})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTemporary = (status) => status === 503 || status === 429 || status === 502;

// Calls fn up to 3 times while the provider says it's busy
async function withRetries(attempts, fn) {
  let result;
  for (const { arg, wait } of attempts) {
    if (wait) await sleep(wait);
    result = await fn(arg);
    if (!isTemporary(result.status)) break;
    console.warn(`AI ${arg} returned ${result.status}, retrying...`);
  }
  return result;
}

async function askOpenAI({ prompt, system, json, schema }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing in server/.env");
  const messages = [
    ...(system || json
      ? [{ role: "system", content: [system, json ? "Respond only with valid JSON." : "", schema ? `JSON shape: ${JSON.stringify(schema)}` : ""].filter(Boolean).join("\n") }]
      : []),
    { role: "user", content: prompt },
  ];
  const r = await withRetries(
    [{ arg: OPENAI_MODEL, wait: 0 }, { arg: OPENAI_MODEL, wait: 1000 }, { arg: OPENAI_MODEL, wait: 2500 }],
    async (model) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  return { reply: r.data.choices?.[0]?.message?.content || "" };
}

async function askGemini({ prompt, system, json, schema }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in server/.env");
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(json
      ? { generationConfig: { responseMimeType: "application/json", ...(schema ? { responseSchema: schema } : {}) } }
      : {}),
  };
  const r = await withRetries(
    [
      { arg: GEMINI_MODEL, wait: 0 },
      { arg: GEMINI_MODEL, wait: 1000 },
      { arg: GEMINI_MODEL, wait: 2500 },
      ...(GEMINI_FALLBACK_MODEL ? [{ arg: GEMINI_FALLBACK_MODEL, wait: 0 }] : []),
    ],
    async (model) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  return { reply: r.data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
}

const PROVIDERS = { anthropic: askAnthropic, openai: askOpenAI, gemini: askGemini };
const ask = (opts) => (PROVIDERS[AI_PROVIDER] || askGemini)(opts);

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

app.post("/api/ai", requireAuth, async (req, res) => {
  const { prompt, system, json } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const result = await ask({ prompt, system, json });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reply: result.reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Garages
// ==========================================
const deviceLastSeen = new Map(); // garage id -> ISO time of the device's last poll

// Busy slots for a garage (start/end only, no renter details)
const busySlots = (bookings) => bookings.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));

app.get("/api/garages", requireAuth, route(async (_req, res) => {
  res.json({ garages: (await repo.listGarages()).map(G.publicGarage) });
}));

// The host's own garages, including the device key to flash onto the ESP32
app.get("/api/garages/mine", requireAuth, route(async (req, res) => {
  const garages = await repo.listGaragesByHost(req.user.id);
  res.json({ garages: garages.map((g) => ({ ...g, device_last_seen: deviceLastSeen.get(g.id) ?? null })) });
}));

app.get("/api/garages/:id", requireAuth, route(async (req, res) => {
  const garage = await repo.getGarage(req.params.id);
  if (!garage) return res.status(404).json({ error: "Garage not found" });
  const isHost = garage.host_id === req.user.id;
  const bookings = await repo.listBookingsForGarage(garage.id);
  res.json({
    garage: isHost ? garage : G.publicGarage(garage),
    busy: busySlots(bookings.filter((b) => new Date(b.ends_at) > new Date())),
  });
}));

// Host listing body -> { fields } ready to store, or { error }. Used by create and edit.
function garageFields(b = {}) {
  const errors = [];
  const title = String(b.title ?? "").trim();
  const area = String(b.area ?? "").trim();
  if (!title) errors.push("title is required");
  if (!area) errors.push("area is required");
  if (!G.SIZES.includes(b.size)) errors.push(`size must be one of ${G.SIZES.join(", ")}`);
  if (!G.ACCESS.includes(b.access)) errors.push(`access must be one of ${G.ACCESS.join(", ")}`);
  const priceHour = Number(b.price_hour);
  const priceDay = Number(b.price_day);
  if (!(priceHour > 0)) errors.push("price_hour must be above 0");
  if (!(priceDay > 0)) errors.push("price_day must be above 0");
  const lat = b.latitude == null ? null : Number(b.latitude);
  const lng = b.longitude == null ? null : Number(b.longitude);
  if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) errors.push("location is invalid");
  const description = String(b.description ?? "").trim();
  if (description.length > G.DESCRIPTION_MAX) errors.push(`description can be at most ${G.DESCRIPTION_MAX} characters`);
  const { availability, error: availabilityError } = G.normalizeAvailability(b.availability);
  if (availabilityError) errors.push(availabilityError);
  if (errors.length) return { error: errors.join("; ") };

  return {
    fields: {
      title: title.slice(0, 120),
      area: area.slice(0, 80),
      address: String(b.address ?? "").trim().slice(0, 160) || null,
      latitude: lat,
      longitude: lng,
      size: b.size,
      covered: !!b.covered,
      price_hour: priceHour,
      price_day: priceDay,
      access: b.access,
      image_url: /^https?:\/\//.test(b.image_url ?? "") ? String(b.image_url).slice(0, 500) : null,
      description: description || null,
      availability,
    },
  };
}

// Host side: list a garage. The server creates its device key.
app.post("/api/garages", requireAuth, route(async (req, res) => {
  const { fields, error } = garageFields(req.body);
  if (error) return res.status(400).json({ error });
  const garage = await repo.createGarage({ host_id: req.user.id, ...fields });
  res.status(201).json({ garage });
}));

// Host side: edit your own listing (prices, location, specs, free hours). Existing bookings stay.
app.patch("/api/garages/:id", requireAuth, route(async (req, res) => {
  const garage = await repo.getGarage(req.params.id);
  if (!garage) return res.status(404).json({ error: "Garage not found" });
  if (garage.host_id !== req.user.id) return res.status(403).json({ error: "Only the garage's host can edit it" });
  const { fields, error } = garageFields(req.body);
  if (error) return res.status(400).json({ error });
  res.json({ garage: await repo.updateGarage(garage.id, fields) });
}));

// Plain-language search -> AI filters -> matching garages
// Body: { query, now_local: "YYYY-MM-DDTHH:mm", tz_offset: Date#getTimezoneOffset(), time_zone?: "Europe/Sofia" }
const searchCache = new Map(); // same question in the same hour -> same filters, no second AI call

app.post("/api/garages/search", requireAuth, route(async (req, res) => {
  const query = String(req.body?.query ?? "").trim();
  const nowLocal = String(req.body?.now_local ?? "");
  const tzOffset = Number(req.body?.tz_offset ?? 0);
  const timeZone = typeof req.body?.time_zone === "string" ? req.body.time_zone : null;
  if (!query) return res.status(400).json({ error: "Missing query" });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nowLocal)) return res.status(400).json({ error: "now_local must look like 2026-10-24T16:30" });

  const cacheKey = `${query.toLowerCase()}|${nowLocal.slice(0, 13)}`;
  let filters = searchCache.get(cacheKey);
  if (!filters) {
    const result = await ask({
      prompt: G.buildSearchPrompt(query, nowLocal),
      system: G.SEARCH_SYSTEM,
      json: true,
      schema: G.SEARCH_SCHEMA,
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    filters = parseJson(result.reply);
    if (!filters) return res.status(502).json({ error: "The AI returned an unreadable answer. Try rephrasing." });
    searchCache.set(cacheKey, filters);
  }

  let fromUtc = G.localToUtc(filters.from, tzOffset, timeZone);
  let toUtc = G.localToUtc(filters.to, tzOffset, timeZone);
  if (!fromUtc || !toUtc || new Date(toUtc) <= new Date(fromUtc)) fromUtc = toUtc = null;

  const [garages, bookings] = await Promise.all([repo.listGarages(), repo.listAllConfirmedBookings()]);
  const matches = garages.filter(
    (g) =>
      G.fits(g.size, filters.vehicle_size) &&
      (filters.covered !== true || g.covered) &&
      (!fromUtc || G.isAvailable(g, fromUtc, toUtc)) &&
      (!fromUtc || !bookings.some((b) => b.garage_id === g.id && G.overlaps(b.starts_at, b.ends_at, fromUtc, toUtc)))
  );
  const area = G.AREAS.find((a) => a.name === filters.area);

  res.json({
    filters,
    from_utc: fromUtc,
    to_utc: toUtc,
    center: area ? { latitude: area.latitude, longitude: area.longitude } : null,
    garages: matches.map(G.publicGarage),
  });
}));

// ==========================================
// Bookings
// ==========================================
const MAX_BOOKING_DAYS = 31;

// Body: { garage_id, starts_at, ends_at, mode: "hour" | "day" }. The AI never books: only this tap does.
app.post("/api/bookings", requireAuth, route(async (req, res) => {
  const { garage_id, starts_at, ends_at, mode } = req.body || {};
  const garage = await repo.getGarage(garage_id);
  if (!garage) return res.status(404).json({ error: "Garage not found" });
  if (!G.BOOKING_MODES.includes(mode)) return res.status(400).json({ error: "mode must be hour or day" });

  const start = new Date(starts_at);
  const end = new Date(ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return res.status(400).json({ error: "Invalid dates" });
  if (end <= start) return res.status(400).json({ error: "The end must be after the start" });
  // A booking may start at the top of the current hour, not earlier
  if (start < new Date(Date.now() - G.HOUR_MS)) return res.status(400).json({ error: "That time has already passed" });
  if (end - start > MAX_BOOKING_DAYS * 24 * G.HOUR_MS) return res.status(400).json({ error: `Bookings can be at most ${MAX_BOOKING_DAYS} days` });

  if (!G.isAvailable(garage, start, end)) {
    return res.status(409).json({ error: "The host hasn't made the garage available then. Pick a time inside its free hours." });
  }

  const existing = await repo.listBookingsForGarage(garage.id);
  if (existing.some((b) => G.overlaps(b.starts_at, b.ends_at, start, end))) {
    return res.status(409).json({ error: "Someone already booked part of that time. Pick another slot." });
  }

  const booking = await repo.createBooking({
    garage_id: garage.id,
    renter_id: req.user.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    mode,
    total_price: G.priceFor(garage, start, end, mode),
  });
  res.status(201).json({ booking: { ...booking, garage: G.publicGarage(garage) } });
}));

app.get("/api/bookings/mine", requireAuth, route(async (req, res) => {
  const [bookings, garages] = await Promise.all([repo.listBookingsByRenter(req.user.id), repo.listGarages()]);
  const byId = new Map(garages.map((g) => [g.id, G.publicGarage(g)]));
  res.json({ bookings: bookings.map((b) => ({ ...b, garage: byId.get(b.garage_id) ?? null })) });
}));

// ==========================================
// Door: the shared contract with the ESP32 team
// ==========================================
// A command nobody picked up in this time is dropped, so a door never opens long after the tap
const COMMAND_TIMEOUT_MS = 20000;
const isStale = (c) => Date.now() - new Date(c.created_at).getTime() > COMMAND_TIMEOUT_MS;

// App -> server. Only a renter with a booking that covers right now can open the door.
app.post("/api/garages/:id/open", requireAuth, route(async (req, res) => {
  const garage = await repo.getGarage(req.params.id);
  if (!garage) return res.status(404).json({ error: "Garage not found" });
  if (garage.access !== "app") return res.status(400).json({ error: "This garage is opened by the host, not from the app" });

  const booking = await repo.findActiveBooking(req.user.id, garage.id);
  if (!booking) return res.status(403).json({ error: "You don't have a booking for this garage right now" });

  const command = await repo.createCommand({ garage_id: garage.id, booking_id: booking.id, requested_by: req.user.id });
  res.status(201).json({ command_id: command.id });
}));

// App polls this after tapping Open: { status: "queued" | "opened" | "error" }
app.get("/api/commands/:id", requireAuth, route(async (req, res) => {
  let command = await repo.getCommand(req.params.id);
  if (!command || command.requested_by !== req.user.id) return res.status(404).json({ error: "Command not found" });
  if (command.status === "queued" && isStale(command)) {
    command = await repo.updateCommand(command.id, { status: "error", error: "The door didn't respond. Is the device online?" });
  }
  res.json({ status: command.status, acked_at: command.acked_at, error: command.error });
}));

// ESP32 polls every ~1 s with header X-Device-Key -> { command_id, action } | {}
app.get("/api/device/commands", requireDevice, route(async (req, res) => {
  const command = await repo.takeNextCommand(req.garage.id);
  if (!command) return res.json({});
  if (isStale(command)) {
    await repo.updateCommand(command.id, { status: "error", error: "Expired before the device picked it up" });
    return res.json({});
  }
  res.json({ command_id: command.id, action: command.action });
}));

// ESP32 -> server: { command_id, status: "opened" | "error", error? }
app.post("/api/device/ack", requireDevice, route(async (req, res) => {
  const { command_id, status, error } = req.body || {};
  if (!["opened", "error"].includes(status)) return res.status(400).json({ error: "status must be opened or error" });
  const command = await repo.getCommand(command_id);
  if (!command || command.garage_id !== req.garage.id) return res.status(404).json({ error: "Command not found" });
  if (command.status !== "queued") return res.json({ ok: true }); // already acked or expired

  await repo.updateCommand(command.id, {
    status,
    acked_at: new Date().toISOString(),
    error: status === "error" ? String(error || "The device reported an error").slice(0, 200) : null,
  });
  res.json({ ok: true });
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Demo device keys (seed garages g1, g2): ${repo.SEED_KEYS.g1}, ${repo.SEED_KEYS.g2}`);
});
