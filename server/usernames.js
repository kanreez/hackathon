// Usernames: format rules, picking one from a person's name, and uniqueness (ignoring case).
// Stored lowercase; older mixed-case usernames still match because every lookup ignores case.

const USERNAME_RE = /^[a-z][a-z0-9._]{1,18}[a-z0-9]$/; // 3-20 chars, starts with a letter
const RESERVED = new Set(["admin", "administrator", "support", "help", "garagego", "root", "system", "host", "renter", "null"]);

// Bulgarian Cyrillic -> Latin (the official streamlined system), so "Иван Петров" -> "ivan.petrov"
const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya", ё: "yo", ы: "y", э: "e", є: "ye", і: "i", ї: "yi",
};

const transliterate = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // drop accents: "José" -> "jose"

const slug = (s) => transliterate(s).replace(/[^a-z0-9]+/g, "");

// The username we'd like for this person, before checking it's free: "first.last"
function baseFromName(first, last) {
  let base = [slug(first), slug(last)].filter(Boolean).join(".");
  if (!/^[a-z]/.test(base)) base = `user${base}`.replace(/\.$/, "");
  base = base.slice(0, 17).replace(/[._]+$/, ""); // room for a number suffix
  return base.length >= 3 ? base : `${base}user`.slice(0, 17);
}

// Null if the username is fine, else what's wrong with it
function usernameProblem(name) {
  if (!USERNAME_RE.test(name)) {
    return "Use 3 to 20 characters: Latin letters, numbers, dots or underscores, starting with a letter";
  }
  if (/[._]{2}/.test(name)) return "Don't put two dots or underscores in a row";
  if (RESERVED.has(name)) return "That username is reserved";
  return null;
}

// ILIKE treats % and _ as wildcards; escape them so "a_b" only matches "a_b"
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function createUsernames(supabase) {
  // Profile ids whose username equals `name`, ignoring case
  async function owners(name) {
    const { data, error } = await supabase.from("profiles").select("id").ilike("username", escapeLike(name));
    if (error) throw new Error(error.message);
    return data.map((r) => r.id);
  }

  async function isAvailable(name, exceptUserId) {
    if (usernameProblem(name)) return false;
    return (await owners(name)).every((id) => id === exceptUserId);
  }

  // base, then base2, base3... the first one nobody has (one query for all candidates)
  async function pickFree(base) {
    const { data, error } = await supabase.from("profiles").select("username").ilike("username", `${escapeLike(base)}%`);
    if (error) throw new Error(error.message);
    const taken = new Set(data.map((r) => String(r.username).toLowerCase()));
    if (!taken.has(base) && !RESERVED.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  }

  // Login by username: the account's id, or null
  async function idFor(name) {
    const ids = await owners(String(name).trim().toLowerCase());
    return ids[0] ?? null;
  }

  return { isAvailable, pickFree, idFor };
}

module.exports = { USERNAME_RE, baseFromName, usernameProblem, escapeLike, transliterate, createUsernames };
