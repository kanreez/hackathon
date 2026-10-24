import { Earnings, PaymentSummary, PayResult } from "../types/garage";
import { api } from "./api";

// The server decides whether something is paid; the app only asks. Mock provider for now:
// test cards are in server/payments/mock.js.

type PayInput =
  | { card_number: string; idempotency_key: string }
  | { wallet: true; idempotency_key: string }
  | { action_confirmed: true; idempotency_key: string }; // approving a "confirm in your bank app" step

export async function confirmPayment(paymentId: string, input: PayInput) {
  return api.post<PayResult>(`/api/payments/${paymentId}/confirm`, input);
}

export async function getPayment(paymentId: string) {
  return api.get<PaymentSummary>(`/api/payments/${paymentId}`);
}

// Paid and not started -> refunded. Unpaid -> just frees the slot.
export async function cancelBooking(bookingId: string) {
  return api.post<{ status: "cancelled"; refund: boolean; refunded_cents: number }>(`/api/bookings/${bookingId}/cancel`);
}

export async function hostEarnings() {
  return api.get<Earnings>("/api/host/earnings");
}

// One key per pay attempt, so a double tap or a retry after a lost response isn't charged twice
export const newIdempotencyKey = () => `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
