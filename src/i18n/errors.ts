import { t, TKey } from "./index";

// The server and Supabase answer in English. Known messages are translated here, where they
// arrive (services/api.ts, AuthContext); anything unknown is shown as it came.
const EXACT: Record<string, TKey> = {
  "Wrong username, email or password": "err.badLogin",
  "Invalid login credentials": "err.badLogin",
  "Confirm your email first: check your inbox": "err.confirmEmail",
  "Email not confirmed": "err.confirmEmail",
  "Too many tries. Wait a few minutes and try again.": "err.tooManyTries",
  "Enter your username or email and your password": "err.loginMissing",
  "Enter your first and last name": "err.nameMissing",
  "Enter a valid email": "err.emailInvalid",
  "Use at least 6 characters for the password": "err.passwordShort",
  "Password should be at least 6 characters.": "err.passwordShort",
  "An account with this email already exists. Log in instead.": "err.emailTaken",
  "User already registered": "err.emailTaken",
  "That username is taken": "err.usernameTaken",
  "That username is reserved": "err.usernameReserved",
  "Use 3 to 20 characters: Latin letters, numbers, dots or underscores, starting with a letter": "err.usernameFormat",
  "Don't put two dots or underscores in a row": "err.usernameDoubles",
  "Search is unavailable right now. Try again in a moment.": "err.searchDown",
  "Garage not found": "err.garageNotFound",
  "This garage isn't taking bookings right now": "err.garageHidden",
  "This garage still has bookings that haven't ended. Hide it now and delete it after the last one.": "err.deleteHasBookings",
  "city must be one of the listed cities": "err.cityUnknown",
  "Pick a photo to upload": "err.photoMissing",
  "That photo is too big. Pick a smaller one.": "err.photoTooBig",
  "That file isn't a photo. Use a JPEG, PNG or WebP.": "err.photoType",
  "Too many photos for now. Try again in an hour.": "err.photoLimit",
  "location must be in Bulgaria": "err.notInBulgaria",
  "Type 3 to 160 characters of the address": "err.addressLength",
  "Only a paid booking can end early": "err.leaveNotPaid",
  "This booking hasn't started yet. Cancel it instead.": "err.leaveNotStarted",
  "This booking has already ended": "err.leaveEnded",
  "Booking not found": "err.bookingNotFound",
  "Payment not found": "err.paymentNotFound",
  "Someone already booked part of that time. Pick another slot.": "err.slotTaken",
  "That time has already passed": "err.timePassed",
  "The end must be after the start": "err.endBeforeStart",
  "The host hasn't made the garage available then. Pick a time inside its free hours.": "err.outsideHours",
  "Reservation expired. Book the slot again.": "err.reservationExpired",
  "This reservation already expired": "err.reservationExpired",
  "This booking was cancelled": "err.bookingCancelled",
  "This booking is already cancelled": "err.bookingCancelled",
  "This booking has already started, so it can't be cancelled": "err.alreadyStarted",
  "This booking is already paid": "err.alreadyPaid",
  "This garage is opened by the host, not from the app": "err.manualDoor",
  "No paid active booking for this garage": "err.noActiveBooking",
  "The door didn't respond. Is the device online?": "err.doorTimeout",
  "Expired before the device picked it up": "err.doorTimeout",
  "Only paid bookings can be reviewed": "err.reviewUnpaid",
  "You can review this garage once your booking starts": "err.reviewTooEarly",
  "Pick 1 to 5 stars": "err.pickStars",
  "Only the garage's host can edit it": "err.notHost",
  "Enter a card number or use the demo wallet": "err.cardMissing",
  "Card number is invalid.": "err.cardInvalid",
  "Your card was declined.": "err.cardDeclined",
  "Insufficient funds.": "err.insufficientFunds",
  "Confirm the payment in your bank app.": "err.confirmInBank",
  "Missing token": "err.signedOut",
  "Invalid token": "err.signedOut",
  "Network request failed": "err.offline",
  "Failed to fetch": "err.offline",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Bookings can be at most (\d+) days$/, (m) => t("err.maxDays", { n: m[1] })],
  [/^Keep the comment under (\d+) characters$/, (m) => t("err.commentLong", { n: m[1] })],
  [/^Request failed \((\d+)\)$/, (m) => t("err.requestFailed", { code: m[1] })],
  [/^The database needs an update first: run supabase\/([\w.-]+) in Supabase$/, (m) => t("err.needsMigration", { file: m[1] })],
];

export function translateError(message: string): string {
  const key = EXACT[message.trim()];
  if (key) return t(key);
  for (const [re, make] of PATTERNS) {
    const m = message.match(re);
    if (m) return make(m);
  }
  return message;
}
