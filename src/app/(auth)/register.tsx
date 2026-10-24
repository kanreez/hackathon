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
import { colors, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Shown inline: Alert.alert does nothing on web
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      setInfo("");
      await signup(email.trim(), password, fullName.trim());
      setInfo("Account created. If email confirmation is on, check your inbox.");
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
        <StickerHeadline lead="Book it." sticker="Open it." />
        <Text style={styles.subtitle}>{APP_TAGLINE}</Text>
        <Text style={styles.title}>Create your account</Text>
      </View>
      <View style={styles.form}>
        <Input label="Full name" placeholder="Maria Ivanova" autoComplete="name" value={fullName} onChangeText={setFullName} />
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
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
          error={error}
        />
        <Button title="Create account" variant="accent" loading={loading} onPress={onSubmit} style={styles.submit} />
        {info ? <Text style={{ ...typography.label, color: colors.success }}>{info}</Text> : null}
      </View>
      <Text style={styles.footer}>
        Already have an account?{" "}
        <Link href="/login" style={styles.link}>
          Log in
        </Link>
      </Text>
    </ScreenWrapper>
  );
}
