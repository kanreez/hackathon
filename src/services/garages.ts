import { Booking, BookingMode, BusySlot, Command, Garage, GarageInput, SearchResult } from "../types/garage";
import { toLocalIso } from "../utils/booking";
import { api } from "./api";

// Everything goes through the Express server: it hides device keys from renters and is the
// only place that decides whether a booking may open a door. Before the Supabase tables exist
// the server serves seed garages from memory, so these work with no database.

export async function listGarages() {
  return (await api.get<{ garages: Garage[] }>("/api/garages")).garages;
}

export async function getGarage(id: string) {
  return api.get<{ garage: Garage; busy: BusySlot[] }>(`/api/garages/${id}`);
}

// Plain-language request -> AI filters + matching garages
export async function searchGarages(query: string) {
  const now = new Date();
  return api.post<SearchResult>("/api/garages/search", {
    query,
    now_local: toLocalIso(now),
    tz_offset: now.getTimezoneOffset(),
  });
}

export async function myGarages() {
  return (await api.get<{ garages: Garage[] }>("/api/garages/mine")).garages;
}

export async function createGarage(input: GarageInput) {
  return (await api.post<{ garage: Garage }>("/api/garages", input)).garage;
}

export async function createBooking(garageId: string, startsAt: Date, endsAt: Date, mode: BookingMode) {
  const res = await api.post<{ booking: Booking }>("/api/bookings", {
    garage_id: garageId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    mode,
  });
  return res.booking;
}

export async function myBookings() {
  return (await api.get<{ bookings: Booking[] }>("/api/bookings/mine")).bookings;
}

// Asks the server to open the door; the ESP32 picks the command up within about a second
export async function openGarage(garageId: string) {
  return (await api.post<{ command_id: string }>(`/api/garages/${garageId}/open`)).command_id;
}

export async function getCommand(id: string) {
  return api.get<Command>(`/api/commands/${id}`);
}
