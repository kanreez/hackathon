import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { StickerHeadline } from "../../components/Bits";
import { BrandMark } from "../../components/BrandMark";
import { APP_TAGLINE } from "../../constants/app";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { authStyles as styles } from "../../constants/authStyles";
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
    <ScreenWrapper scroll style={styles.page}>
      <BrandMark />
      <View style={styles.intro}>
        <StickerHeadline lead="Snap it." sticker="Fix it." />
        <Text style={styles.subtitle}>{APP_TAGLINE}</Text>
        <Text style={styles.title}>Welcome back</Text>
      </View>
      <View style={styles.form}>
        <Input
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          placeholder="Your password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
          error={error}
        />
        <Button title="Log in" variant="accent" loading={loading} onPress={onSubmit} style={styles.submit} />
      </View>
      <Text style={styles.footer}>
        New here?{" "}
        <Link href="/register" style={styles.link}>
          Create an account
        </Link>
      </Text>
    </ScreenWrapper>
  );
}
