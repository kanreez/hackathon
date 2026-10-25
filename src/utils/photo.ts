import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { t } from "../i18n";

const MAX_SIDE = 1600; // px on the longer side: sharp on any screen, a few hundred kB as JPEG
const JPEG_QUALITY = 0.75;

// Lets the host pick a photo (or take one), crops it to 4:3 and shrinks it to a JPEG ready to
// upload. Null if they backed out. Phone photos are several MB; this keeps uploads quick.
export async function pickGaragePhoto(source: "library" | "camera"): Promise<{ uri: string; base64: string } | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 1 };
  if (source === "camera") {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error(t("err.cameraDenied"));
  }
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_SIDE && asset.width >= asset.height) context.resize({ width: MAX_SIDE, height: null });
  else if (asset.height > MAX_SIDE) context.resize({ width: null, height: MAX_SIDE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error(t("err.photoRead"));
  return { uri: saved.uri, base64: saved.base64 };
}
