// The server's price for a booking, in integer euro cents. The app shows its own estimate
// (src/utils/booking.ts, same formula) but never sends an amount: this is what gets charged.

const HOUR_MS = 3600000;
const PLATFORM_FEE_RATE = 0.15; // taken from the host's share; the renter pays the listed price
const CURRENCY = "EUR";

const toCents = (euros) => Math.round(Number(euros) * 100);

// Started hours / days are charged in full
function computePrice(garage, startsAt, endsAt, mode) {
  const hours = (new Date(endsAt) - new Date(startsAt)) / HOUR_MS;
  const byDay = mode === "day";
  // The small allowance keeps a 25-hour day at a clock change from counting as two
  const units = byDay ? Math.max(1, Math.ceil(hours / 24 - 0.05)) : Math.ceil(hours);
  const unitPriceCents = toCents(byDay ? garage.price_day : garage.price_hour);
  const amountCents = units * unitPriceCents;
  const feeCents = Math.round(amountCents * PLATFORM_FEE_RATE);
  return {
    amount_cents: amountCents,
    platform_fee_cents: feeCents,
    host_payout_cents: amountCents - feeCents,
    currency: CURRENCY,
    units,
    unit: byDay ? "day" : "hour",
    unit_price_cents: unitPriceCents,
  };
}

module.exports = { computePrice, CURRENCY, PLATFORM_FEE_RATE };
