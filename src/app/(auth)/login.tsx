import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Headline } from "../../components/Bits";
import { BrandMark } from "../../components/BrandMark";
import { APP_TAGLINE } from "../../constants/app";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { authStyles as styles } from "../../constants/authStyles";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n";

export default function Login() {
  const { login } = useAuth();
  const { t } = useT();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      await login(identifier.trim(), password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper scroll style={styles.page}>
      <BrandMark size={64} />
      <View style={styles.intro}>
        <Headline title={t("auth.headline")} subline={APP_TAGLINE()} />
        <Text style={styles.title}>{t("login.title")}</Text>
      </View>
      <View style={styles.form}>
        <Input
          label={t("login.identifier")}
          placeholder={t("login.identifierPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <Input
          label={t("auth.password")}
          placeholder={t("login.passwordPlaceholder")}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
          error={error}
        />
        <Button title={t("login.submit")} variant="accent" loading={loading} onPress={onSubmit} style={styles.submit} />
      </View>
      <Text style={styles.footer}>
        {t("login.newHere")}{" "}
        <Link href="/register" style={styles.link}>
          {t("login.createAccount")}
        </Link>
      </Text>
    </ScreenWrapper>
  );
}
