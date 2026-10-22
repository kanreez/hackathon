import { PickedImage } from "../utils/media";
import { supabase } from "./supabase";

// Name of the Supabase Storage bucket. Create it in the dashboard (Storage → New bucket).
// Make it "Public" if you want getPublicUrl() links to work without signing.
export const IMAGE_BUCKET = "images";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Uploads an image from pickImage/takePhoto to Supabase Storage and returns its public URL.
 * The image must be picked with { base64: true }, e.g. `await pickImage({ base64: true })`.
 * Files go under `<userId>/<timestamp>.<ext>` so storage policies can restrict users to their own folder.
 */
export async function uploadImage(image: PickedImage, userId: string): Promise<string> {
  if (!image.base64) throw new Error("Pick the image with { base64: true } before uploading");

  const contentType = image.mimeType ?? "image/jpeg";
  const ext = contentType.split("/")[1] ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, base64ToBytes(image.base64), { contentType, upsert: false });
  if (error) throw error;

  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
