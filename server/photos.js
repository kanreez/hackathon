// Garage photos. The app sends the photo (already resized on the phone) as base64; the server
// checks it really is a JPEG, PNG or WebP and stores it in Supabase Storage, in the public bucket
// "garage-photos" (created on first use). If Storage can't be used, the file goes to
// server/uploads and this server serves it, so listing a garage never depends on Storage.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BUCKET = "garage-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Recognised by their first bytes, never by what the app says the file is
const TYPES = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

const sniff = (buffer) => (buffer.length >= 12 ? TYPES.find((t) => t.test(buffer)) ?? null : null);

// "data:image/jpeg;base64,..." or bare base64 -> Buffer, or null if it isn't base64
function decodeBase64(data) {
  const b64 = String(data ?? "").replace(/^data:[\w/+.-]+;base64,/, "").replace(/\s/g, "");
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  return Buffer.from(b64, "base64");
}

function createPhotoStore(supabase) {
  let bucketReady = null;

  async function ensureBucket() {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: TYPES.map((t) => t.mime),
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  }

  // -> the photo's public URL
  async function save({ buffer, type, userId, baseUrl }) {
    const name = `${userId}/${crypto.randomUUID()}.${type.ext}`;
    try {
      bucketReady ??= ensureBucket().catch((e) => {
        bucketReady = null; // try again next time
        throw e;
      });
      await bucketReady;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(name, buffer, { contentType: type.mime, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
    } catch (e) {
      console.warn(`Photo storage unavailable (${e.message}): saving to server/uploads instead`);
      const file = name.replace("/", "-");
      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_DIR, file), buffer);
      return `${baseUrl}/uploads/${file}`;
    }
  }

  return { save };
}

module.exports = { createPhotoStore, decodeBase64, sniff, MAX_BYTES, UPLOADS_DIR };
