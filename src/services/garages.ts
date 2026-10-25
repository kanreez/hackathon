import { Booking, BookingMode, BusySlot, Checkout, Command, DoorAction, Garage, GarageInput, Review, SearchResult } from "../types/garage";
import { toLocalIso } from "../utils/booking";
import { api } from "./api";

// Everything goes through the Express server: it hides device keys from renters and is the
// only place that decides whether a booking may open a door. Before the Supabase tables exist
// the server serves seed garages from memory, so these work with no database.

export async function listGarages() {
  return (await api.get<{ garages: Garage[] }>("/api/garages")).garages;
}

export async function getGarage(id: string) {
  return api.get<{ garage: Garage; busy: BusySlot[]; reviews: Review[] }>(`/api/garages/${id}`);
}

// Plain-language request -> AI filters + matching garages
export async function searchGarages(query: string) {
  const now = new Date();
  return api.post<SearchResult>("/api/garages/search", {
    query,
    now_local: toLocalIso(now),
    tz_offset: now.getTimezoneOffset(),
    // Lets the server get the offset right for dates across a DST change
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export async function myGarages() {
  return (await api.get<{ garages: Garage[] }>("/api/garages/mine")).garages;
}

export async function createGarage(input: GarageInput) {
  return (await api.post<{ garage: Garage }>("/api/garages", input)).garage;
}

// Host only: the server refuses edits to someone else's garage
export async function updateGarage(id: string, input: GarageInput) {
  return (await api.patch<{ garage: Garage }>(`/api/garages/${id}`, input)).garage;
}

// Host side: uploads a photo (base64 JPEG from utils/photo.ts) -> its public URL for image_url
export async function uploadGaragePhoto(base64: string) {
  return (await api.post<{ url: string }>("/api/uploads/garage-photo", { data: base64 })).url;
}

// Host only. Hidden = off search and no new bookings; bookings already made keep working.
export async function setGarageHidden(id: string, hidden: boolean) {
  return (await api.put<{ garage: Garage }>(`/api/garages/${id}/visibility`, { hidden })).garage;
}

// Host only, permanent. The server refuses while the garage has bookings that haven't ended.
export async function deleteGarage(id: string) {
  await api.delete<{ deleted: true }>(`/api/garages/${id}`);
}

// Creates the booking unpaid (it holds the slot for 10 minutes) and its payment. The server
// sets the price; pay with confirmPayment() from services/payments.ts.
export async function createBooking(garageId: string, startsAt: Date, endsAt: Date, mode: BookingMode) {
  return api.post<Checkout>("/api/bookings", {
    garage_id: garageId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    mode,
  });
}

// Ends a booking that's under way now, so the rest of the time frees up. No refund.
export async function leaveEarly(bookingId: string) {
  return (await api.post<{ booking: Booking }>(`/api/bookings/${bookingId}/leave`)).booking;
}

export async function myBookings() {
  return (await api.get<{ bookings: Booking[] }>("/api/bookings/mine")).bookings;
}

// Asks the server to open or close the door; the ESP32 picks the command up within about a second
export async function sendDoorCommand(garageId: string, action: DoorAction) {
  return (await api.post<{ command_id: string }>(`/api/garages/${garageId}/${action}`)).command_id;
}

// Create or edit your review of a stay. The server checks it's your paid booking and it has started.
export async function saveReview(bookingId: string, rating: number, comment: string) {
  return (await api.put<{ review: Review }>(`/api/bookings/${bookingId}/review`, { rating, comment })).review;
}

export async function getCommand(id: string) {
  return api.get<Command>(`/api/commands/${id}`);
}
