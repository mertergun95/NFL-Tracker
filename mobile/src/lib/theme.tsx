/** Tema — web'deki index.css token'larının React Native karşılığı.
 *
 *  Kural web ile aynı: kullanıcı bir kez seçtiyse o seçim kalıcıdır,
 *  seçmediyse ("system") cihaz görünümü izlenir ve sistem değişince
 *  uygulama da canlı olarak takip eder.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

export type Scheme = "dark" | "light";
export type ThemePref = Scheme | "system";

export interface Palette {
  bg: string;
  bgSoft: string;
  bgRaised: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentText: string;
  link: string;
  good: string;
  goodBg: string;
  bad: string;
  badBg: string;
  warn: string;
  warnBg: string;
  errBg: string;
  errBorder: string;
  errText: string;
}

const DARK: Palette = {
  bg: "#0d1117",
  bgSoft: "#161b22",
  bgRaised: "#1a2230",
  border: "#2d333b",
  text: "#e6edf3",
  textDim: "#8b949e",
  accent: "#d50a0a",
  accentText: "#ffffff",
  link: "#58a6ff",
  good: "#3fb950",
  goodBg: "#12351f",
  bad: "#f85149",
  badBg: "#3d1f12",
  warn: "#d29922",
  warnBg: "#3a2d0d",
  errBg: "#2d1618",
  errBorder: "#6e2c2c",
  errText: "#f0b6b6",
};

const LIGHT: Palette = {
  bg: "#ffffff",
  bgSoft: "#f2f4f7",
  bgRaised: "#e9edf3",
  border: "#d3d9e0",
  text: "#16202b",
  textDim: "#5a6673",
  accent: "#b30909",
  accentText: "#ffffff",
  link: "#0a58ca",
  good: "#1a7f37",
  goodBg: "#dbf3e0",
  bad: "#b42318",
  badBg: "#fbe3e0",
  warn: "#8a6100",
  warnBg: "#fdf1d6",
  errBg: "#fbe3e0",
  errBorder: "#e5a9a3",
  errText: "#8c1d18",
};

/** Ölçek: boşluk, yuvarlama, yazı boyu. Tüm ekranlar bunu kullanır. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const font = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 26, display: 32,
} as const;

const STORAGE_KEY = "statgrade.theme";

interface ThemeValue {
  scheme: Scheme;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  c: Palette;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "dark" || v === "light" || v === "system") setPrefState(v);
    });
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const scheme: Scheme = pref === "system" ? (system === "light" ? "light" : "dark") : pref;

  const value = useMemo(
    () => ({ scheme, pref, setPref, c: scheme === "light" ? LIGHT : DARK }),
    [scheme, pref, setPref],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { scheme: "dark", pref: "system", setPref: () => {}, c: DARK };
  return ctx;
}

/** Sadece renkler lazımsa kısayol. */
export const useColors = (): Palette => useTheme().c;
