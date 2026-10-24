// Data access for garages, bookings and door commands.
// Uses the Supabase tables from supabase/garages.sql when they exist, otherwise an in-memory
// store (seeded below) so the demo works before the database is set up. Memory is lost on restart.
const crypto = require("crypto");

const newDeviceKey = () => crypto.randomBytes(16).toString("hex");

// Dev-only keys for the two seeded "app" garages, so an ESP32 can be flashed once and keep
// working across server restarts. Real garages get a random key from newDeviceKey().
const SEED_KEYS = {
  g1: process.env.DEMO_DEVICE_KEY_1 || "dev-door-lagera-1",
  g2: process.env.DEMO_DEVICE_KEY_2 || "dev-door-krasno-2",
};

const seedGarage = (id, fields) => ({
  id,
  host_id: null,
  image_url: null,
  description: null,
  availability: null,
  device_key: SEED_KEYS[id] ?? newDeviceKey(),
  created_at: new Date().toISOString(),
  ...fields,
});

const SEED_GARAGES = [
  seedGarage("g1", {
    title: "Covered garage by Pirogov (sample)", area: "Lagera", address: "ul. Tsar Samuil 110",
    latitude: 42.6879, longitude: 23.3009, size: "medium", covered: true, price_hour: 3, price_day: 20, access: "app",
  }),
  seedGarage("g2", {
    title: "Wide garage with remote door (sample)", area: "Krasno Selo", address: "bul. Tsar Boris III 41",
    latitude: 42.6822, longitude: 23.2901, size: "large", covered: true, price_hour: 4, price_day: 25, access: "app",
  }),
  seedGarage("g3", {
    title: "Small box near the metro (sample)", area: "Lagera", address: "ul. Dimitar Petkov 12",
    latitude: 42.6851, longitude: 23.2982, size: "small", covered: true, price_hour: 2, price_day: 12, access: "manual",
  }),
  seedGarage("g4", {
    title: "Open yard spot, Hristo Botev (sample)", area: "Lagera", address: "bul. Hristo Botev 64",
    latitude: 42.6905, longitude: 23.3041, size: "medium", covered: false, price_hour: 1.5, price_day: 9, access: "manual",
    // Host parks here evenings and weekends, so it's free Mon–Fri 08:00–18:00
    availability: [1, 2, 3, 4, 5].map((day) => ({ day, start: 8, end: 18 })),
  }),
  seedGarage("g5", {
    title: "Basement garage, Hladilnika (sample)", area: "Krasno Selo", address: "ul. Kozyak 8",
    latitude: 42.6789, longitude: 23.2932, size: "medium", covered: true, price_hour: 2.5, price_day: 15, access: "manual",
  }),
  seedGarage("g6", {
    title: "Garage by South Park (sample)", area: "Lozenets", address: "ul. Krichim 21",
    latitude: 42.6741, longitude: 23.3196, size: "large", covered: true, price_hour: 3.5, price_day: 22, access: "manual",
  }),
  seedGarage("g7", {
    title: "Covered spot on Cherni Vrah (sample)", area: "Lozenets", address: "bul. Cherni Vrah 47",
    latitude: 42.6712, longitude: 23.3261, size: "small", covered: true, price_hour: 2, price_day: 13, access: "manual",
  }),
];

const TABLE_RECHECK_MS = 30000;

function createRepo(supabase) {
  const mem = { garages: [...SEED_GARAGES], bookings: [], payments: [], commands: [] };
  const tableOk = {}; // table -> { ok, checkedAt }

  // Whether Supabase has the table; falls back to memory if not. A found table is remembered;
  // a missing one is checked again after TABLE_RECHECK_MS, so running the SQL while the
  // server is up switches it over without a restart.
  async function hasTable(table) {
    const known = tableOk[table];
    if (known?.ok) return true;
    if (known && Date.now() - known.checkedAt < TABLE_RECHECK_MS) return false;

    // A HEAD probe reports a missing table as success, so read one real row
    const { error } = await supabase.from(table).select("*").limit(1);
    tableOk[table] = { ok: !error, checkedAt: Date.now() };
    if (error && !known) console.warn(`${table}: using in-memory store (${error.message}). Checking again every 30 s.`);
    if (!error && known) console.log(`${table}: found in Supabase, using it from now on`);
    return !error;
  }

  const must = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  // ---------- garages ----------
  async function listGarages() {
    if (await hasTable("garages")) return must(await supabase.from("garages").select("*").order("created_at"));
    return [...mem.garages];
  }

  async function getGarage(id) {
    if (await hasTable("garages")) return must(await supabase.from("garages").select("*").eq("id", id).maybeSingle());
    return mem.garages.find((g) => g.id === id) ?? null;
  }

  async function getGarageByDeviceKey(key) {
    if (!key) return null;
    if (await hasTable("garages")) return must(await supabase.from("garages").select("*").eq("device_key", key).maybeSingle());
    return mem.garages.find((g) => g.device_key === key) ?? null;
  }

  async function listGaragesByHost(hostId) {
    if (await hasTable("garages")) {
      return must(await supabase.from("garages").select("*").eq("host_id", hostId).order("created_at"));
    }
    return mem.garages.filter((g) => g.host_id === hostId);
  }

  async function createGarage(fields) {
    const row = { ...fields, device_key: newDeviceKey() };
    if (await hasTable("garages")) return must(await supabase.from("garages").insert(row).select("*").single());
    const garage = { id: crypto.randomUUID(), created_at: new Date().toISOString(), image_url: null, ...row };
    mem.garages.push(garage);
    return garage;
  }

  // The caller checks the host owns it; device_key and host_id are never changed here
  async function updateGarage(id, fields) {
    if (await hasTable("garages")) return must(await supabase.from("garages").update(fields).eq("id", id).select("*").single());
    const garage = mem.garages.find((g) => g.id === id);
    if (!garage) return null;
    Object.assign(garage, fields);
    return garage;
  }

  // ---------- bookings ----------
  // Statuses: pending_payment (holds the slot until expires_at) -> paid | cancelled | expired
  const LIVE = ["pending_payment", "paid"];

  // Unpaid bookings past their hold become "expired". Done lazily before reads and overlap
  // checks instead of on a timer; the database's overlap constraint relies on it.
  async function expireStaleBookings(now = new Date()) {
    const iso = now.toISOString();
    if (await hasTable("bookings")) {
      must(await supabase.from("bookings").update({ status: "expired" }).eq("status", "pending_payment").lt("expires_at", iso));
      return;
    }
    for (const b of mem.bookings) {
      if (b.status === "pending_payment" && b.expires_at && b.expires_at < iso) b.status = "expired";
    }
  }

  // Bookings that block their slot: paid, or unpaid and still held
  async function listBookingsForGarage(garageId) {
    await expireStaleBookings();
    if (await hasTable("bookings")) {
      return must(await supabase.from("bookings").select("*").eq("garage_id", garageId).in("status", LIVE));
    }
    return mem.bookings.filter((b) => b.garage_id === garageId && LIVE.includes(b.status));
  }

  async function listAllLiveBookings() {
    await expireStaleBookings();
    if (await hasTable("bookings")) return must(await supabase.from("bookings").select("*").in("status", LIVE));
    return mem.bookings.filter((b) => LIVE.includes(b.status));
  }

  async function getBooking(id) {
    await expireStaleBookings();
    if (await hasTable("bookings")) return must(await supabase.from("bookings").select("*").eq("id", id).maybeSingle());
    return mem.bookings.find((b) => b.id === id) ?? null;
  }

  async function updateBooking(id, patch) {
    if (await hasTable("bookings")) return must(await supabase.from("bookings").update(patch).eq("id", id).select("*").maybeSingle());
    const booking = mem.bookings.find((b) => b.id === id);
    if (booking) Object.assign(booking, patch);
    return booking ?? null;
  }

  // Every booking of these garages, for the host's earnings
  async function listBookingsForGarages(garageIds) {
    if (!garageIds.length) return [];
    if (await hasTable("bookings")) return must(await supabase.from("bookings").select("*").in("garage_id", garageIds));
    return mem.bookings.filter((b) => garageIds.includes(b.garage_id));
  }

  async function listBookingsByRenter(renterId) {
    await expireStaleBookings();
    if (await hasTable("bookings")) {
      return must(
        await supabase.from("bookings").select("*").eq("renter_id", renterId).order("starts_at", { ascending: false })
      );
    }
    return mem.bookings
      .filter((b) => b.renter_id === renterId)
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  }

  async function createBooking(fields) {
    const row = { status: "pending_payment", ...fields };
    if (await hasTable("bookings")) return must(await supabase.from("bookings").insert(row).select("*").single());
    const booking = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
    mem.bookings.push(booking);
    return booking;
  }

  // The renter's paid booking for this garage that covers "now", if any
  async function findActiveBooking(renterId, garageId, now = new Date()) {
    const iso = now.toISOString();
    if (await hasTable("bookings")) {
      const rows = must(
        await supabase
          .from("bookings")
          .select("*")
          .eq("renter_id", renterId)
          .eq("garage_id", garageId)
          .eq("status", "paid")
          .lte("starts_at", iso)
          .gt("ends_at", iso)
          .limit(1)
      );
      return rows[0] ?? null;
    }
    return (
      mem.bookings.find(
        (b) =>
          b.renter_id === renterId &&
          b.garage_id === garageId &&
          b.status === "paid" &&
          new Date(b.starts_at) <= now &&
          new Date(b.ends_at) > now
      ) ?? null
    );
  }

  // ---------- payments ----------
  async function createPayment(fields) {
    const row = { status: "pending", currency: "EUR", ...fields };
    if (await hasTable("payments")) return must(await supabase.from("payments").insert(row).select("*").single());
    const now = new Date().toISOString();
    const payment = {
      id: crypto.randomUUID(),
      method: null,
      card_last4: null,
      card_brand: null,
      failure_message: null,
      idempotency_key: null,
      created_at: now,
      updated_at: now,
      ...row,
    };
    mem.payments.push(payment);
    return payment;
  }

  async function getPayment(id) {
    if (await hasTable("payments")) return must(await supabase.from("payments").select("*").eq("id", id).maybeSingle());
    return mem.payments.find((p) => p.id === id) ?? null;
  }

  async function getPaymentByKey(key) {
    if (await hasTable("payments")) return must(await supabase.from("payments").select("*").eq("idempotency_key", key).maybeSingle());
    return mem.payments.find((p) => p.idempotency_key === key) ?? null;
  }

  async function updatePayment(id, patch) {
    const row = { ...patch, updated_at: new Date().toISOString() };
    if (await hasTable("payments")) return must(await supabase.from("payments").update(row).eq("id", id).select("*").maybeSingle());
    const payment = mem.payments.find((p) => p.id === id);
    if (payment) Object.assign(payment, row);
    return payment ?? null;
  }

  async function listPaymentsForBookings(bookingIds) {
    if (!bookingIds.length) return [];
    if (await hasTable("payments")) return must(await supabase.from("payments").select("*").in("booking_id", bookingIds));
    return mem.payments.filter((p) => bookingIds.includes(p.booking_id));
  }

  // ---------- door commands ----------
  async function createCommand(fields) {
    const row = { action: "open", status: "queued", ...fields };
    if (await hasTable("device_commands")) {
      return must(await supabase.from("device_commands").insert(row).select("*").single());
    }
    const command = { id: crypto.randomUUID(), created_at: new Date().toISOString(), delivered_at: null, acked_at: null, error: null, ...row };
    mem.commands.push(command);
    return command;
  }

  async function getCommand(id) {
    if (await hasTable("device_commands")) {
      return must(await supabase.from("device_commands").select("*").eq("id", id).maybeSingle());
    }
    return mem.commands.find((c) => c.id === id) ?? null;
  }

  async function updateCommand(id, patch) {
    if (await hasTable("device_commands")) {
      return must(await supabase.from("device_commands").update(patch).eq("id", id).select("*").maybeSingle());
    }
    const command = mem.commands.find((c) => c.id === id);
    if (command) Object.assign(command, patch);
    return command ?? null;
  }

  // Oldest queued command the device hasn't been handed yet. Marking it delivered stops a
  // device that polls every second from opening the door twice for one tap.
  async function takeNextCommand(garageId) {
    let next;
    if (await hasTable("device_commands")) {
      const rows = must(
        await supabase
          .from("device_commands")
          .select("*")
          .eq("garage_id", garageId)
          .eq("status", "queued")
          .is("delivered_at", null)
          .order("created_at")
          .limit(1)
      );
      next = rows[0];
    } else {
      next = mem.commands.find((c) => c.garage_id === garageId && c.status === "queued" && !c.delivered_at);
    }
    if (!next) return null;
    return updateCommand(next.id, { delivered_at: new Date().toISOString() });
  }

  return {
    SEED_KEYS,
    listGarages,
    getGarage,
    getGarageByDeviceKey,
    listGaragesByHost,
    createGarage,
    updateGarage,
    expireStaleBookings,
    listBookingsForGarage,
    listAllLiveBookings,
    getBooking,
    updateBooking,
    listBookingsForGarages,
    listBookingsByRenter,
    createBooking,
    findActiveBooking,
    createPayment,
    getPayment,
    getPaymentByKey,
    updatePayment,
    listPaymentsForBookings,
    createCommand,
    getCommand,
    updateCommand,
    takeNextCommand,
  };
}

module.exports = { createRepo };
