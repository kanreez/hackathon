// Picks the payment implementation from PAYMENT_PROVIDER in server/.env (default "mock"),
// like AI_PROVIDER. A real provider (e.g. Stripe) only needs a file with the same three
// functions added here; the routes in server.js don't change.
//
//   createPayment({ bookingId, userId, amountCents, platformFeeCents, hostPayoutCents, currency }) -> payment row
//   confirmPayment({ paymentId, cardNumber, wallet, idempotencyKey, actionConfirmed })
//     -> { status: "succeeded" | "declined" | "requires_action", message?, card_last4?, card_brand?, method? }
//   refundPayment({ paymentId }) -> payment row
const { createMockProvider } = require("./mock");
const { PaymentError } = require("./errors");

const PROVIDERS = { mock: createMockProvider };

function createPaymentProvider(repo) {
  const name = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const make = PROVIDERS[name];
  if (!make) throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);
  const impl = make(repo);

  // Two requests with the same key at the same time (a double tap) share one attempt
  const inFlight = new Map();
  function confirmPayment(opts) {
    const key = opts.idempotencyKey;
    if (inFlight.has(key)) return inFlight.get(key);
    const attempt = impl.confirmPayment(opts).finally(() => inFlight.delete(key));
    inFlight.set(key, attempt);
    return attempt;
  }

  return { name, createPayment: impl.createPayment, confirmPayment, refundPayment: impl.refundPayment };
}

module.exports = { createPaymentProvider, PaymentError };
