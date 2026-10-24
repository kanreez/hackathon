import * as ImagePicker from "expo-image-picker";

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
  fileName?: string | null;
  base64?: string | null;
};

export async function pickImage(options: { base64?: boolean; quality?: number } = {}): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") throw new Error("Photo library permission denied");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: options.quality ?? 0.8,
    base64: options.base64 ?? false,
  });

  if (result.canceled) return null;
  return result.assets[0] as PickedImage;
}

export async function takePhoto(options: { base64?: boolean; quality?: number } = {}): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") throw new Error("Camera permission denied");

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: options.quality ?? 0.8,
    base64: options.base64 ?? false,
  });

  if (result.canceled) return null;
  return result.assets[0] as PickedImage;
}