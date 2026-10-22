import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Modal() {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Text className="text-xl font-semibold">Global Modal</Text>
      <Link dismissTo href="/" className="text-blue-600">
        Close
      </Link>
    </View>
  );
}