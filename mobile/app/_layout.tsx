import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "../src/lib/i18n";
import { ThemeProvider, useTheme } from "../src/lib/theme";

/** Stack başlıkları da tema token'larını kullansın diye ayrı bileşen:
 *  useTheme yalnızca ThemeProvider'ın içinde okunabiliyor. */
function Navigator() {
  const { c, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bgSoft },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ title: "" }} />
        <Stack.Screen name="team/[abbr]" options={{ title: "" }} />
        <Stack.Screen name="game/[season]/[gameId]" options={{ title: "" }} />
        <Stack.Screen name="teams" />
        <Stack.Screen name="standings" />
        <Stack.Screen name="injuries" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="depth" />
        <Stack.Screen name="accuracy" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <Navigator />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
