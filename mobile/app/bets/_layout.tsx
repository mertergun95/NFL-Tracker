/** Bahis takip bölümü.
 *
 *  Oturum yoksa yerleşim sekmeleri hiç kurmadan /bets-login'e yönlendiriyor:
 *  ne bir ekran bir kare için görünüyor, ne de cihazdaki bahis verisi okunuyor.
 */
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View, type ColorValue } from "react-native";
import { useAuth } from "../../src/lib/auth";
import { AppProvider } from "../../src/bettracker/state/AppContext";
import { useI18n } from "../../src/bettracker/i18n";
import { BetTrackerI18n } from "../../src/bettracker/i18n/provider";
import { font, useTheme } from "../../src/lib/theme";

/** Sekme simgeleri emoji: bu bölümdeki kavramların (kasa, hesap makinesi)
 *  uygulamanın Icon setinde karşılığı yok. */
const tabIcon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue; focused: boolean }) {
    return <Text style={{ fontSize: 18, color: String(color) }}>{glyph}</Text>;
  };

/** Sekme başlıkları modülün kendi sözlüğünden geldiği için ayrı bileşen. */
function BetsTabs() {
  const { c } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bgSoft },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textDim,
        tabBarStyle: { backgroundColor: c.bgSoft, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("nav.dashboard"), headerTitle: t("app.name"),
                   tabBarIcon: tabIcon("📊") }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: t("nav.bets"), tabBarIcon: tabIcon("🎯") }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ title: t("nav.analytics"), tabBarIcon: tabIcon("📈") }}
      />
      <Tabs.Screen
        name="tools"
        options={{ title: t("nav.calculators"), tabBarIcon: tabIcon("🧮") }}
      />
      <Tabs.Screen
        name="bankrolls"
        options={{ title: t("nav.bankrolls"), tabBarIcon: tabIcon("💰") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("nav.settings"), tabBarIcon: tabIcon("⚙️") }}
      />
      {/* Bahis düzenleme ekranı sekme değil; listeden açılır. */}
      <Tabs.Screen name="bet/[id]" options={{ href: null, title: t("bet.bet") }} />
    </Tabs>
  );
}

export default function BetsLayout() {
  const { status } = useAuth();
  const { c } = useTheme();

  // Oturum okunana kadar bekle: giriş ekranı bir kare bile görünüp kaybolmasın.
  if (status === "checking") {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center",
                     justifyContent: "center" }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  // Oturum yoksa sağlayıcılar hiç kurulmaz; cihazdaki bahis verisi de okunmaz.
  if (status !== "in") return <Redirect href="/bets-login" />;

  return (
    <AppProvider>
      <BetTrackerI18n>
        <BetsTabs />
      </BetTrackerI18n>
    </AppProvider>
  );
}
