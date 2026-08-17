/** Bahis takip bölümünün giriş ekranı.
 *
 *  Kendi rotası var (app/bets-login.tsx) ve bölüm oturum yokken buraya
 *  yönlendiriyor. Kapıyı doğrudan bets/_layout içinde çizmek yerine ayrı bir
 *  rota olması Expo Router'ın önerdiği düzen: yerleşim her zaman bir gezgin
 *  döndürüyor, giriş ekranı da bağlı bir gezginin içinde yaşıyor.
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { font, radius, space, useColors } from "../lib/theme";

export default function Login() {
  const { rememberedUser, signIn } = useAuth();
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  // Hatırlanmış bir kullanıcı varsa açık gelsin — kullanıcı zaten bir kez
  // "hatırla" demiş, her girişte tekrar açması gerekmesin.
  const [remember, setRemember] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rememberedUser) setUser(rememberedUser);
  }, [rememberedUser]);

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await signIn(user, password, remember);
    setBusy(false);
    if (ok) {
      // replace, push değil: geri tuşu girişe dönmesin.
      router.replace("/bets");
      return;
    }
    setFailed(true);
    setPassword("");
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: c.text,
    fontSize: font.md,
  } as const;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* İçerik dikeyde ortalanmıyor: bir ScrollView'ın içeriğini flexGrow ile
          ortalamak, klavye açılınca formu yukarı taşırken sıçratıyor. Üstten
          boşluk vermek hem sakin duruyor hem de uzun ekranlarda taşmıyor. */}
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: c.text, fontSize: font.xxl, fontWeight: "800" }}>
          {t("login.title")}
        </Text>
        <Text style={{ color: c.textDim, fontSize: font.sm, marginTop: space.xs,
                       lineHeight: 19 }}>
          {t("login.sub")}
        </Text>

        <Text style={{ color: c.textDim, fontSize: font.sm, marginTop: space.xl,
                       marginBottom: space.xs }}>
          {t("login.user")}
        </Text>
        <TextInput
          value={user}
          onChangeText={setUser}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholderTextColor={c.textDim}
          style={inputStyle}
        />

        <Text style={{ color: c.textDim, fontSize: font.sm, marginTop: space.md,
                       marginBottom: space.xs }}>
          {t("login.pass")}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          placeholderTextColor={c.textDim}
          style={inputStyle}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md,
                       marginTop: space.lg }}>
          <Switch
            value={remember}
            onValueChange={setRemember}
            trackColor={{ true: c.accent, false: c.border }}
          />
          <Text style={{ color: c.text, fontSize: font.md }}>{t("login.remember")}</Text>
        </View>

        {failed ? (
          <View style={{ marginTop: space.lg, padding: space.md, borderRadius: radius.md,
                         backgroundColor: c.errBg, borderWidth: 1, borderColor: c.errBorder }}>
            <Text style={{ color: c.errText, fontSize: font.sm }}>{t("login.failed")}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: space.lg,
            paddingVertical: 14,
            borderRadius: radius.md,
            alignItems: "center",
            backgroundColor: c.accent,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: c.accentText, fontSize: font.md, fontWeight: "700" }}>
            {busy ? t("login.checking") : t("login.submit")}
          </Text>
        </Pressable>

        <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: space.lg,
                       lineHeight: 17 }}>
          {t("login.notice")}
        </Text>

        {/* Girişi yapamayan biri uygulamaya dönebilsin diye. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/")}
          hitSlop={10}
          style={{ marginTop: space.lg, alignSelf: "flex-start" }}
        >
          <Text style={{ color: c.link, fontSize: font.sm }}>
            ← {t("nav.backToStats")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
