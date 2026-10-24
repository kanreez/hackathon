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
  area: string;
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
  // Only on the host's own garages
  device_key?: string;
  device_last_seen?: string | null;
};

export type GarageInput = Pick<
  Garage,
    | "title"
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

export type Booking = {
  id: string;
  garage_id: string;
  renter_id: string;
  starts_at: string;
  ends_at: string;
  mode: BookingMode;
  total_price: number;
  status: "confirmed" | "cancelled";
  created_at: string;
  garage: Garage | null;
};

// What the AI understood from the plain-language request
export type SearchFilters = {
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
};

export type CommandStatus = "queued" | "opened" | "error";
export type Command = { status: CommandStatus; acked_at: string | null; error: string | null };
