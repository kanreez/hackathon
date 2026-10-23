import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { ChipRow } from "../../components/Chip";
import { Header } from "../../components/Header";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Loading } from "../../components/StateViews";
import { notify } from "../../components/Toast";
import { CATEGORIES, Item } from "../../constants/mockData";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { createItem, getItem, updateItem, USE_MOCK } from "../../services/items";
import { uploadImage } from "../../services/storage";
import { Coords, getCurrentLocation } from "../../utils/location";
import { PickedImage, pickImage, takePhoto } from "../../utils/media";

// One screen for both: /item/edit creates, /item/edit?id=123 edits
export default function ItemForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Item["category"]>(CATEGORIES[0].value);
  const [imageUri, setImageUri] = useState(""); // what's shown (existing URL or local preview)
  const [picked, setPicked] = useState<PickedImage | null>(null); // new photo to upload on save
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  useEffect(() => {
    if (!id) return;
    getItem(id)
      .then((item) => {
        if (!item) throw new Error("Item not found");
        setTitle(item.title);
        setDescription(item.description);
        setPrice(String(item.price));
        setCategory(item.category);
        setImageUri(item.image);
        if (item.latitude != null && item.longitude != null) {
          setCoords({ latitude: item.latitude, longitude: item.longitude });
        }
      })
      .catch((e) => notify(e.message, "error"))
      .finally(() => setLoading(false));
  }, [id]);

  const choosePhoto = async (source: "library" | "camera") => {
    try {
      const img = source === "library" ? await pickImage({ base64: true }) : await takePhoto({ base64: true });
      if (!img) return;
      setPicked(img);
      setImageUri(img.uri);
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const addLocation = async () => {
    try {
      setCoords(await getCurrentLocation());
      notify("Location added");
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Add a title.";
    const p = Number(price.replace(",", "."));
    if (price.trim() && (Number.isNaN(p) || p < 0)) next.price = "Enter a number, like 12 or 9.99.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      let image = imageUri;
      // With a real database, upload the new photo to Supabase Storage first
      if (picked && !USE_MOCK && user) image = await uploadImage(picked, user.id);
      if (!image) image = `https://picsum.photos/seed/${encodeURIComponent(title)}/600/400`;

      const values = {
        title: title.trim(),
        description: description.trim(),
        price: price.trim() ? Number(price.replace(",", ".")) : 0,
        category,
        image,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      };

      if (isEdit) {
        await updateItem(id!, values);
        notify("Changes saved");
      } else {
        await createItem({ ...values, rating: 0 });
        notify("Item added");
      }
      router.back();
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scroll style={styles.page}>
      <Header back title={isEdit ? "Edit item" : "New item"} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a photo"
        onPress={() => choosePhoto("library")}
        style={({ pressed }) => [styles.photo, pressed && { opacity: 0.85 }]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="image-outline" size={30} color={colors.ink} />
            <Text style={styles.photoText}>Add a photo</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.row}>
        <Button title="Choose photo" icon="images-outline" size="sm" variant="secondary" onPress={() => choosePhoto("library")} />
        <Button title="Take photo" icon="camera-outline" size="sm" variant="secondary" onPress={() => choosePhoto("camera")} />
      </View>

      <View style={styles.form}>
        <Input label="Title" placeholder="What is it?" value={title} onChangeText={setTitle} error={errors.title} />
        <Input
          label="Description"
          placeholder="A few sentences people will find useful"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Input
          label="Price"
          placeholder="0"
          hint="Leave empty for free."
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          error={errors.price}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <ChipRow options={CATEGORIES} value={category} onChange={setCategory} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          {coords ? (
            <View style={styles.row}>
              <Text style={styles.locationText}>
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </Text>
              <Button title="Remove" size="sm" variant="ghost" onPress={() => setCoords(null)} />
            </View>
          ) : (
            <Button
              title="Use my location"
              icon="locate"
              size="sm"
              variant="secondary"
              onPress={addLocation}
              style={{ alignSelf: "flex-start" }}
            />
          )}
        </View>

        <Button title={isEdit ? "Save changes" : "Add item"} loading={saving} onPress={save} style={styles.submit} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 640, width: "100%", alignSelf: "center" },
  photo: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  photoText: { ...typography.label, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  form: { gap: spacing.md, marginTop: spacing.lg },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.ink },
  locationText: { ...typography.body, color: colors.ink },
  submit: { marginTop: spacing.md },
});
