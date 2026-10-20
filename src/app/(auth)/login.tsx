import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 32, fontWeight: "700", marginBottom: 16 }}>Login</Text>
        <Input label="Email" placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} error={error} />
        <Button title="Sign In" loading={loading} onPress={onSubmit} />
        <Link href="/register" style={{ textAlign: "center", color: "#2563eb" }}>
          No account? Register
        </Link>
      </View>
    </ScreenWrapper>
  );
}