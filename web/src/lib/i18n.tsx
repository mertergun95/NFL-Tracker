import { createContext, useCallback, useContext, useEffect,
         useMemo, useState, type ReactNode } from "react";
import { STRINGS } from "./locales";

export const LANGS = ["en", "tr", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = {
  en: "EN", tr: "TR", de: "DE",
};

const STORAGE_KEY = "nfltracker.lang";

/** Modül seviyesi dil: label()/fmt() gibi hook olmayan yardımcılar okur. */
let currentLang: Lang = "en";
export const getLang = (): Lang => currentLang;

function detect(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  const nav = window.navigator.language.slice(0, 2).toLowerCase();
  return nav === "tr" ? "tr" : nav === "de" ? "de" : "en";
}
currentLang = detect();

/** Sözlükten çeviri; {var} yer tutucuları params ile doldurulur. */
export function translate(key: string, params?: Record<string, string | number>,
                          lang: Lang = currentLang): string {
  const entry = STRINGS[key];
  let out: string;
  if (!entry) out = key;
  else if (typeof entry === "string") out = entry;
  else out = entry[LANGS.indexOf(lang)] ?? entry[0];
  if (params)
    for (const [k, v] of Object.entries(params))
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  return out;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detect());

  useEffect(() => {
    currentLang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  currentLang = lang; // render sırasında da güncel olsun

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, params, lang),
    [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: currentLang, setLang: () => {}, t: translate };
  return ctx;
}

/** Pipeline'dan gelen {en,tr,de} alanını (ya da düz dizeyi) seçili dile göre
    çözer — insights başlık/detaylarında kullanılır. */
export function localized(v: unknown, lang: Lang = currentLang): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  const rec = v as Record<string, string>;
  return rec[lang] ?? rec.en ?? Object.values(rec)[0] ?? "";
}

/** Sadece t() lazımsa kısayol. */
export const useT = () => useI18n().t;
