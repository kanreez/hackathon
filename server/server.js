const path = require("path");
// Load server/.env no matter which folder the server is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { askAnthropic } = require("./anthropic");
const G = require("./garages");
const { createRepo } = require("./repo");
const { createPaymentProvider, PaymentError } = require("./payments/provider");
const { computePrice } = require("./payments/pricing");

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
const payments = createPaymentProvider(repo);

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

// Wraps a route so thrown errors become a 500 with the message (a PaymentError keeps its own status)
const route = (fn) => (req, res) =>
  fn(req, res).catch((err) => res.status(err instanceof PaymentError ? err.status : 500).json({ error: err.message }));

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
// AI: Claude, then Gemini Flash-Lite, then Gemini, then OpenAI, each only if its key is set
// ==========================================
// The app never talks to a model directly. The only AI feature is the garage search, and its
// answer is always parsed and validated into filters before anything reaches the user, so a
// prompt-injected model can't put its own text in front of anyone.
const AI_PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase(); // tried first
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Fast and plenty for turning a request into filters; the full Flash models can take over 15 s
// when busy. "gemini-flash-lite-latest" is an alias Google keeps pointing at the current Lite.
const GEMINI_LITE_MODEL = process.env.GEMINI_LITE_MODEL || "gemini-flash-lite-latest";
// Optional second Gemini model, tried when the main one is overloaded
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const MODEL_BY_PROVIDER = {
  anthropic: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
  "gemini-lite": GEMINI_LITE_MODEL,
  gemini: GEMINI_MODEL,
  openai: OPENAI_MODEL,
};
const KEY_BY_PROVIDER = { anthropic: "ANTHROPIC_API_KEY", "gemini-lite": "GEMINI_API_KEY", gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY" };
const AI_TIMEOUT_MS = 15000; // per provider, so a hanging one falls through to the next quickly

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTemporary = (status) => status === 503 || status === 429 || status === 502;

// Calls fn again while the provider says it's busy
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
    [{ arg: OPENAI_MODEL, wait: 0 }, { arg: OPENAI_MODEL, wait: 800 }],
    async (model) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  const message = r.data.choices?.[0]?.message;
  if (message?.refusal) return { refused: true };
  return { reply: message?.content || "" };
}

async function askGemini({ prompt, system, json, schema, model: mainModel = GEMINI_MODEL }) {
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
      { arg: mainModel, wait: 0 },
      { arg: mainModel, wait: 800 },
      ...(GEMINI_FALLBACK_MODEL && mainModel === GEMINI_MODEL ? [{ arg: GEMINI_FALLBACK_MODEL, wait: 0 }] : []),
    ],
    async (model) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(AI_TIMEOUT_MS) }
      );
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  // Blocked by Gemini's safety filters: an answer ("not something to search for"), not a failure
  const candidate = r.data.candidates?.[0];
  if (r.data.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") return { refused: true };
  return { reply: candidate?.content?.parts?.[0]?.text || "" };
}

const PROVIDERS = {
  anthropic: askAnthropic,
  "gemini-lite": (opts) => askGemini({ ...opts, model: GEMINI_LITE_MODEL }),
  gemini: askGemini,
  openai: askOpenAI,
};
// AI_PROVIDER first, then the rest in this order; providers without a key are skipped
const AI_CHAIN = [AI_PROVIDER, "anthropic", "gemini-lite", "gemini", "openai"]
  .filter((p, i, all) => PROVIDERS[p] && all.indexOf(p) === i)
  .filter((p) => process.env[KEY_BY_PROVIDER[p]]);
console.log(
  AI_CHAIN.length
    ? `AI: ${AI_CHAIN.map((p) => `${p} (${MODEL_BY_PROVIDER[p]})`).join(" -> ")}`
    : "AI: no provider has a key. Add ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY to server/.env."
);

// Asks each provider in turn until one gives an answer that `accept` turns into a value
// (accept returns undefined for an unusable answer, which moves on to the next provider).
// Returns { value, provider } | { refused: true, provider } | { error }.
async function askWithFallback(opts, accept) {
  const failures = [];
  for (const name of AI_CHAIN) {
    try {
      const r = await PROVIDERS[name](opts);
      if (r.refused) return { refused: true, provider: name };
      if (r.error) {
        failures.push(`${name}: ${r.error}`);
        continue;
      }
      const value = accept(r.reply);
      if (value === undefined) {
        failures.push(`${name}: answer didn't pass validation`);
        continue;
      }
      if (failures.length) console.warn(`AI: answered by ${name} after ${failures.join("; ")}`);
      return { value, provider: name };
    } catch (err) {
      failures.push(`${name}: ${err.name === "TimeoutError" ? "timed out" : err.message}`);
    }
  }
  console.warn(`AI: no provider could answer (${failures.join("; ") || "none configured"})`);
  return { error: "Search is unavailable right now. Try again in a moment." };
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// ==========================================
// Garages
// ==========================================
const deviceLastSeen = new Map(); // garage id -> ISO time of the device's last poll

// Busy slots for a garage (start/end only, no renter details)
const busySlots = (bookings) => bookings.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));

// ---------- reviews ----------
const NO_RATING = { average: null, count: 0 };

// What anyone may see of a review: no renter or booking ids
const publicReview = (r) => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment,
  author_name: r.author_name,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

// "Maria Ivanova" -> "Maria I."; never the email
function shortName(user, profile) {
  const full = String(profile?.full_name || user.user_metadata?.full_name || "").trim();
  if (!full) return "A renter";
  const [first, ...rest] = full.split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

app.get("/api/garages", requireAuth, route(async (_req, res) => {
  const [garages, ratings] = await Promise.all([repo.listGarages(), repo.ratingSummaries()]);
  res.json({ garages: garages.map((g) => ({ ...G.publicGarage(g), rating: ratings.get(g.id) ?? NO_RATING })) });
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
  const [bookings, reviews, ratings] = await Promise.all([
    repo.listBookingsForGarage(garage.id),
    repo.listReviewsForGarage(garage.id),
    repo.ratingSummaries(),
  ]);
  res.json({
    garage: { ...(isHost ? garage : G.publicGarage(garage)), rating: ratings.get(garage.id) ?? NO_RATING },
    busy: busySlots(bookings.filter((b) => new Date(b.ends_at) > new Date())),
    reviews: reviews.map(publicReview),
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
  const query = G.sanitizeQuery(req.body?.query);
  const nowLocal = String(req.body?.now_local ?? "");
  const tzOffset = Number(req.body?.tz_offset ?? 0);
  const timeZone = typeof req.body?.time_zone === "string" ? req.body.time_zone : null;
  if (!query) return res.status(400).json({ error: "Missing query" });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nowLocal)) return res.status(400).json({ error: "now_local must look like 2026-10-24T16:30" });

  const cacheKey = `${query.toLowerCase()}|${nowLocal.slice(0, 13)}`;
  let filters = searchCache.get(cacheKey);
  if (!filters) {
    const result = await askWithFallback(
      { prompt: G.buildSearchPrompt(query, nowLocal), system: G.SEARCH_SYSTEM, json: true, schema: G.SEARCH_SCHEMA },
      (reply) => G.cleanFilters(parseJson(reply))
    );
    if (result.error) return res.status(503).json({ error: result.error });
    // A model refusing the request means it isn't a garage search either
    filters = result.refused ? G.cleanFilters({ on_topic: false }) : result.value;
    searchCache.set(cacheKey, filters);
  }

  // Not about garages, parking or cars: no AI text, just the same fixed hint every time
  if (!filters.on_topic) {
    return res.json({ off_topic: true, hint: G.OFF_TOPIC_HINT, filters, from_utc: null, to_utc: null, center: null, garages: [] });
  }

  let fromUtc = G.localToUtc(filters.from, tzOffset, timeZone);
  let toUtc = G.localToUtc(filters.to, tzOffset, timeZone);
  if (!fromUtc || !toUtc || new Date(toUtc) <= new Date(fromUtc)) fromUtc = toUtc = null;

  const [garages, bookings, ratings] = await Promise.all([repo.listGarages(), repo.listAllLiveBookings(), repo.ratingSummaries()]);
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
    garages: matches.map((g) => ({ ...G.publicGarage(g), rating: ratings.get(g.id) ?? NO_RATING })),
  });
}));

// ==========================================
// Bookings
// ==========================================
const MAX_BOOKING_DAYS = 31;
const HOLD_MS = 10 * 60000; // an unpaid booking holds its slot this long

// Body: { garage_id, starts_at, ends_at, mode: "hour" | "day" }. The AI never books: only this tap does.
// Creates the booking unpaid plus its payment; the app then opens the pay sheet. Any amount the
// app sends is ignored: the price comes from the garage's prices (payments/pricing.js).
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

  const price = computePrice(garage, start, end, mode);
  let booking;
  try {
    booking = await repo.createBooking({
      garage_id: garage.id,
      renter_id: req.user.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      mode,
      total_price: price.amount_cents / 100,
      amount_cents: price.amount_cents,
      expires_at: new Date(Date.now() + HOLD_MS).toISOString(),
    });
  } catch (err) {
    // Two taps raced for the same slot: the database's overlap constraint stopped the second
    if (/bookings_no_overlap|exclusion/i.test(err.message)) {
      return res.status(409).json({ error: "Someone already booked part of that time. Pick another slot." });
    }
    throw err;
  }
  const payment = await payments.createPayment({
    bookingId: booking.id,
    userId: req.user.id,
    amountCents: price.amount_cents,
    platformFeeCents: price.platform_fee_cents,
    hostPayoutCents: price.host_payout_cents,
    currency: price.currency,
  });

  res.status(201).json({
    booking_id: booking.id,
    payment_id: payment.id,
    amount_cents: price.amount_cents,
    platform_fee_cents: price.platform_fee_cents,
    currency: price.currency,
    expires_at: booking.expires_at,
    units: price.units,
    unit: price.unit,
    unit_price_cents: price.unit_price_cents,
  });
}));

// What the renter sees of a payment: never the card beyond its last 4 digits
const paymentSummary = (p) =>
  p && {
    id: p.id,
    status: p.status,
    amount_cents: p.amount_cents,
    currency: p.currency,
    method: p.method,
    card_last4: p.card_last4,
    card_brand: p.card_brand,
  };

app.get("/api/bookings/mine", requireAuth, route(async (req, res) => {
  const [bookings, garages] = await Promise.all([repo.listBookingsByRenter(req.user.id), repo.listGarages()]);
  const ids = bookings.map((b) => b.id);
  const [pays, reviews] = await Promise.all([repo.listPaymentsForBookings(ids), repo.listReviewsForBookings(ids)]);
  const byId = new Map(garages.map((g) => [g.id, G.publicGarage(g)]));
  const payByBooking = new Map(pays.map((p) => [p.booking_id, p]));
  const reviewByBooking = new Map(reviews.map((r) => [r.booking_id, publicReview(r)]));
  res.json({
    bookings: bookings.map((b) => ({
      ...b,
      garage: byId.get(b.garage_id) ?? null,
      payment: paymentSummary(payByBooking.get(b.id)) ?? null,
      review: reviewByBooking.get(b.id) ?? null,
    })),
  });
}));

// Renter reviews a stay: { rating: 1-5, comment? }. Only the booking's renter, only once it's
// paid and has started (they've actually used the garage). Saving again edits the same review.
const MAX_COMMENT = 500;
app.put("/api/bookings/:id/review", requireAuth, route(async (req, res) => {
  const booking = await repo.getBooking(req.params.id);
  if (!booking || booking.renter_id !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== "paid") return res.status(409).json({ error: "Only paid bookings can be reviewed" });
  if (new Date(booking.starts_at) > new Date()) return res.status(409).json({ error: "You can review this garage once your booking starts" });

  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Pick 1 to 5 stars" });
  const comment = String(req.body?.comment ?? "").trim();
  if (comment.length > MAX_COMMENT) return res.status(400).json({ error: `Keep the comment under ${MAX_COMMENT} characters` });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", req.user.id).maybeSingle();
  const review = await repo.upsertReview({
    booking_id: booking.id,
    garage_id: booking.garage_id,
    renter_id: req.user.id,
    rating,
    comment: comment || null,
    author_name: shortName(req.user, profile),
  });
  res.json({ review: publicReview(review) });
}));

// Renter cancels. Paid and not started yet -> cancelled and refunded. Unpaid (e.g. the pay
// sheet was closed) -> cancelled, which frees the slot. Paid and already started -> 409.
app.post("/api/bookings/:id/cancel", requireAuth, route(async (req, res) => {
  const booking = await repo.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.renter_id !== req.user.id) return res.status(403).json({ error: "This isn't your booking" });
  if (booking.status === "cancelled") return res.status(409).json({ error: "This booking is already cancelled" });
  if (booking.status === "expired") return res.status(409).json({ error: "This reservation already expired" });

  const [payment] = await repo.listPaymentsForBookings([booking.id]);
  let refundedCents = 0;
  if (booking.status === "paid") {
    if (new Date(booking.starts_at) <= new Date()) {
      return res.status(409).json({ error: "This booking has already started, so it can't be cancelled" });
    }
    if (payment?.status === "succeeded") {
      await payments.refundPayment({ paymentId: payment.id });
      refundedCents = payment.amount_cents;
    }
  }
  await repo.updateBooking(booking.id, { status: "cancelled" });
  res.json({ status: "cancelled", refund: refundedCents > 0, refunded_cents: refundedCents });
}));

// ==========================================
// Payments (mock by default: see payments/provider.js)
// ==========================================
async function ownPayment(req, res) {
  const payment = await repo.getPayment(req.params.id);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return null;
  }
  if (payment.user_id !== req.user.id) {
    res.status(403).json({ error: "This isn't your payment" });
    return null;
  }
  return payment;
}

// Body: { card_number?, wallet?: true, idempotency_key, action_confirmed? }
// -> { status: "succeeded" | "declined" | "requires_action", message?, card_last4?, card_brand?, method? }
// The card number is only passed to the provider to decide the outcome; it's never stored or logged.
app.post("/api/payments/:id/confirm", requireAuth, route(async (req, res) => {
  const payment = await ownPayment(req, res);
  if (!payment) return;
  const { card_number, wallet, idempotency_key, action_confirmed } = req.body || {};
  const key = String(idempotency_key ?? "");
  if (!/^[\w-]{8,100}$/.test(key)) return res.status(400).json({ error: "idempotency_key is required" });
  if (!wallet && !action_confirmed && !card_number) return res.status(400).json({ error: "Enter a card number or use the demo wallet" });

  const booking = await repo.getBooking(payment.booking_id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === "expired") return res.status(409).json({ error: "Reservation expired. Book the slot again." });
  if (booking.status === "cancelled") return res.status(409).json({ error: "This booking was cancelled" });

  const result = await payments.confirmPayment({
    paymentId: payment.id,
    cardNumber: card_number,
    wallet: wallet === true,
    idempotencyKey: key,
    actionConfirmed: action_confirmed === true,
  });
  if (result.status === "succeeded" && booking.status !== "paid") {
    await repo.updateBooking(booking.id, { status: "paid", expires_at: null });
  }
  res.json(result);
}));

app.get("/api/payments/:id", requireAuth, route(async (req, res) => {
  const payment = await ownPayment(req, res);
  if (payment) res.json(paymentSummary(payment));
}));

// Host side: what the host earned from their garages (after the platform fee, refunds excluded)
app.get("/api/host/earnings", requireAuth, route(async (req, res) => {
  const garages = await repo.listGaragesByHost(req.user.id);
  const bookings = await repo.listBookingsForGarages(garages.map((g) => g.id));
  const pays = (await repo.listPaymentsForBookings(bookings.map((b) => b.id))).filter((p) => p.status === "succeeded");
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const garageById = new Map(garages.map((g) => [g.id, g]));

  const rows = pays
    .map((p) => {
      const b = bookingById.get(p.booking_id);
      return {
        booking_id: b.id,
        garage_id: b.garage_id,
        garage_title: garageById.get(b.garage_id)?.title ?? "Garage",
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        amount_cents: p.amount_cents,
        host_payout_cents: p.host_payout_cents,
      };
    })
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));

  res.json({
    total_payout_cents: rows.reduce((sum, r) => sum + r.host_payout_cents, 0),
    currency: "EUR",
    bookings: rows,
  });
}));

// ==========================================
// Door: the shared contract with the ESP32 team
// ==========================================
// A command nobody picked up in this time is dropped, so a door never opens long after the tap
const COMMAND_TIMEOUT_MS = 20000;
const isStale = (c) => Date.now() - new Date(c.created_at).getTime() > COMMAND_TIMEOUT_MS;

// App -> server. Only a renter with a paid booking that covers right now can open or close the door.
const doorRoute = (action) => route(async (req, res) => {
  const garage = await repo.getGarage(req.params.id);
  if (!garage) return res.status(404).json({ error: "Garage not found" });
  if (garage.access !== "app") return res.status(400).json({ error: "This garage is opened by the host, not from the app" });

  const booking = await repo.findActiveBooking(req.user.id, garage.id);
  if (!booking) return res.status(403).json({ error: "No paid active booking for this garage" });

  const command = await repo.createCommand({ garage_id: garage.id, booking_id: booking.id, requested_by: req.user.id, action });
  res.status(201).json({ command_id: command.id });
});

app.post("/api/garages/:id/open", requireAuth, doorRoute("open"));
app.post("/api/garages/:id/close", requireAuth, doorRoute("close"));

// App polls this after tapping Open: { status: "queued" | "opened" | "error" }
app.get("/api/commands/:id", requireAuth, route(async (req, res) => {
  let command = await repo.getCommand(req.params.id);
  if (!command || command.requested_by !== req.user.id) return res.status(404).json({ error: "Command not found" });
  if (command.status === "queued" && isStale(command)) {
    command = await repo.updateCommand(command.id, { status: "error", error: "The door didn't respond. Is the device online?" });
  }
  res.json({ status: command.status, acked_at: command.acked_at, error: command.error });
}));

// ESP32 polls every ~1 s with header X-Device-Key -> { command_id, action: "open" | "close" } | {}
app.get("/api/device/commands", requireDevice, route(async (req, res) => {
  const command = await repo.takeNextCommand(req.garage.id);
  if (!command) return res.json({});
  if (isStale(command)) {
    await repo.updateCommand(command.id, { status: "error", error: "Expired before the device picked it up" });
    return res.json({});
  }
  res.json({ command_id: command.id, action: command.action });
}));

// ESP32 -> server: { command_id, status: "opened" | "error", error? }. "opened" means the command was
// carried out, for "close" too (the stored status keeps the existing database check).
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

app.listen(PORT, (err) => {
  if (err) {
    console.error(`Could not start on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Payments: ${payments.name}${payments.name === "mock" ? " (fake checkout, test cards in payments/mock.js)" : ""}`);
  console.log(`Demo device keys (seed garages g1, g2): ${repo.SEED_KEYS.g1}, ${repo.SEED_KEYS.g2}`);
});
