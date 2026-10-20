import { Link } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setLoading(true);
      await signup(email.trim(), password, fullName.trim());
      Alert.alert("Account created", "If email confirmation is on, check your inbox.");
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 32, fontWeight: "700", marginBottom: 16 }}>Register</Text>
        <Input label="Full name" placeholder="Full name" value={fullName} onChangeText={setFullName} />
        <Input label="Email" placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button title="Create Account" loading={loading} onPress={onSubmit} />
        <Link href="/login" style={{ textAlign: "center", color: "#2563eb" }}>
          Have an account? Login
        </Link>
      </View>
    </ScreenWrapper>
  );
}