// Shapes returned by server/server.js. Keep in sync with supabase/garages.sql.

export type GarageSize = "small" | "medium" | "large";
export type Access = "app" | "manual"; // app = door opened by the ESP32, manual = the host lets you in
export type BookingMode = "hour" | "day";

// A weekly window the garage is free, in Sofia time: day 0 = Sunday (like Date#getDay), hours 0-24
export type AvailabilityWindow = { day: number; start: number; end: number };

export type Garage = {
  id: string;
  host_id: string | null;
  title: string;
  city: string; // English name from CITIES (src/constants/garages.ts)
  area: string; // a Sofia district from AREAS, or elsewhere the host's own district (or the city name)
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  size: GarageSize;
  covered: boolean;
  price_hour: number;
  price_day: number;
  access: Access;
  image_url: string | null;
  description: string | null;
  availability: AvailabilityWindow[] | null; // null = free any time
  created_at: string;
  hidden?: boolean; // the host took it off search: no new bookings, existing ones still work
  // Only on the host's own garages
  device_key?: string;
  device_last_seen?: string | null;
  // From reviews; missing on search results
  rating?: RatingSummary;
};

// ---------- reviews ----------
export type RatingSummary = { average: number | null; count: number };

export type Review = {
  id: string;
  rating: number; // 1-5
  comment: string | null;
  author_name: string; // "Maria I."
  created_at: string;
  updated_at: string;
};

export type GarageInput = Pick<
  Garage,
    | "title"
  | "city"
  | "area"
  | "address"
  | "latitude"
  | "longitude"
  | "size"
  | "covered"
  | "price_hour"
  | "price_day"
  | "access"
  | "image_url"
  | "description"
  | "availability"
>;

export type BusySlot = { starts_at: string; ends_at: string };

// pending_payment holds the slot until expires_at; only "paid" can open the door
export type BookingStatus = "pending_payment" | "paid" | "cancelled" | "expired";

export type Booking = {
  id: string;
  garage_id: string;
  renter_id: string;
  starts_at: string;
  ends_at: string;
  mode: BookingMode;
  total_price: number;
  amount_cents: number | null;
  status: BookingStatus;
  expires_at: string | null;
  left_early_at?: string | null; // the renter left early: ends_at was moved to that minute
  created_at: string;
  garage: Garage | null;
  payment: PaymentSummary | null;
  review: Review | null; // the renter's own review of this stay
};

// ---------- payments (mock provider on the server; amounts in euro cents) ----------
export type PaymentStatus = "pending" | "succeeded" | "declined" | "requires_action" | "refunded";

export type PaymentSummary = {
  id: string;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  method: "card" | "wallet" | null;
  card_last4: string | null;
  card_brand: string | null;
};

// What POST /api/bookings returns: an unpaid booking and the payment to confirm
export type Checkout = {
  booking_id: string;
  payment_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  currency: string;
  expires_at: string;
  units: number;
  unit: "hour" | "day";
  unit_price_cents: number;
};

export type PayResult = {
  status: "succeeded" | "declined" | "requires_action";
  message?: string;
  card_last4?: string;
  card_brand?: string;
  method?: "card" | "wallet";
};

export type Earnings = {
  total_payout_cents: number;
  currency: string;
  bookings: {
    booking_id: string;
    garage_id: string;
    garage_title: string;
    starts_at: string;
    ends_at: string;
    amount_cents: number;
    host_payout_cents: number;
  }[];
};

// What the AI understood from the plain-language request
export type SearchFilters = {
  city: string | null;
  area: string | null;
  from: string | null; // local "YYYY-MM-DDTHH:mm"
  to: string | null;
  vehicle_size: GarageSize | null;
  covered: boolean | null;
};

export type SearchResult = {
  filters: SearchFilters;
  from_utc: string | null;
  to_utc: string | null;
  center: { latitude: number; longitude: number } | null;
  garages: Garage[];
  // Set when the request wasn't about garages, parking or cars; hint is a fixed suggestion
  off_topic?: boolean;
  hint?: string;
};

export type DoorAction = "open" | "close";
// "opened" = the device carried the command out, for "close" too
export type CommandStatus = "queued" | "opened" | "error";
export type Command = { status: CommandStatus; acked_at: string | null; error: string | null };
