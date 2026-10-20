import { Text, View } from "react-native";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Profile</Text>
      <Text>{user?.email}</Text>
      <Button title="Sign Out" variant="secondary" onPress={logout} />
    </View>
  );
}