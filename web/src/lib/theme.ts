/** Tema (koyu/açık) durumu.
 *
 * Kural: kullanıcı bir kez seçtiyse o seçim kalıcıdır; seçmediyse işletim
 * sistemi tercihi (prefers-color-scheme) izlenir — sistem teması değişince
 * site de canlı olarak takip eder. Tema, <html data-theme="..."> üzerinden
 * uygulanır; renkler index.css'te token olarak tanımlıdır.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "nfltracker.theme";

const media = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

function stored(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function systemTheme(): Theme {
  return media()?.matches ? "light" : "dark";
}

export function resolveTheme(): Theme {
  return stored() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** İlk boyamadan önce çağrılır (main.tsx) — tema geçişi "flash" etmesin. */
export function initTheme(): void {
  applyTheme(resolveTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Kullanıcı kendi seçimini yapmadıysa sistemi izlemeye devam et
  useEffect(() => {
    const m = media();
    if (!m) return;
    const onChange = () => { if (!stored()) setThemeState(systemTheme()); };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
