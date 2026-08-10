/** Çok dillilik — web ile aynı sözlük, farklı depolama.
 *  localStorage yerine AsyncStorage kullanıldığı için tercih asenkron
 *  okunur; ilk kare varsayılan dille çizilir, kayıtlı tercih gelince
 *  yeniden çizilir. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { STRINGS } from "./locales";
import { MOBILE_STRINGS } from "./locales.mobile";

export const LANGS = ["en", "tr", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { en: "EN", tr: "TR", de: "DE" };
export const LANG_FULL: Record<Lang, string> = {
  en: "English", tr: "Türkçe", de: "Deutsch",
};

const STORAGE_KEY = "statgrade.lang";

const ALL_STRINGS: Record<string, string | [string, string, string]> = {
  ...STRINGS,
  ...MOBILE_STRINGS,
};

/** Modül seviyesi dil: hook olmayan yardımcılar (label(), fmt()) bunu okur. */
let currentLang: Lang = "en";
export const getLang = (): Lang => currentLang;

/** Sözlükten çeviri; {var} yer tutucuları params ile doldurulur. */
export function translate(
  key: string, params?: Record<string, string | number>, lang: Lang = currentLang,
): string {
  const entry = ALL_STRINGS[key];
  let out: string;
  if (!entry) out = key;
  else if (typeof entry === "string") out = entry;
  else out = entry[LANGS.indexOf(lang)] ?? entry[0];
  if (params)
    for (const [k, v] of Object.entries(params))
      out = out.split(`{${k}}`).join(String(v));
  return out;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && (LANGS as readonly string[]).includes(saved)) {
        currentLang = saved as Lang;
        setLangState(saved as Lang);
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    setLangState(l);
    void AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  currentLang = lang; // render sırasında da güncel olsun

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, params, lang),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: currentLang, setLang: () => {}, t: translate };
  return ctx;
}

/** Pipeline'dan gelen {en,tr,de} alanını (ya da düz dizeyi) çözer. */
export function localized(v: unknown, lang: Lang = currentLang): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  const rec = v as Record<string, string>;
  return rec[lang] ?? rec.en ?? Object.values(rec)[0] ?? "";
}

export const useT = () => useI18n().t;
