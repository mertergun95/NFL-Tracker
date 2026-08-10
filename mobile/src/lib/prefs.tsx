/** Kullanıcı tercihleri (tema ve dil dışındakiler).
 *
 *  Şimdilik tek tercih var: takım logoları ve oyuncu fotoğrafları
 *  gösterilsin mi. Bu bir ayar olarak duruyor çünkü iki farklı kullanım
 *  senaryosu var:
 *
 *   - Kişisel kullanım: görseller açık, uygulama web sitesiyle aynı görünür.
 *     Görseller pakete gömülmez, kaynağından (NFL/ESPN) gösterilir.
 *   - Mağaza dağıtımı: kapatılır; takımlar kısaltma + renk rozetiyle
 *     çizilir, pakette hiçbir üçüncü taraf markası bulunmaz.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "statgrade.showImages";

/** Mağazaya çıkarken bunu false yapın (ya da ayardan kapatın). */
const DEFAULT_SHOW_IMAGES = true;

interface PrefsValue {
  showImages: boolean;
  setShowImages: (v: boolean) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [showImages, setShowImagesState] = useState(DEFAULT_SHOW_IMAGES);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "0") setShowImagesState(false);
      else if (v === "1") setShowImagesState(true);
    });
  }, []);

  const setShowImages = useCallback((v: boolean) => {
    setShowImagesState(v);
    void AsyncStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  }, []);

  const value = useMemo(() => ({ showImages, setShowImages }), [showImages, setShowImages]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) return { showImages: DEFAULT_SHOW_IMAGES, setShowImages: () => {} };
  return ctx;
}

/** Sadece "görsel gösterilsin mi" lazımsa kısayol. */
export const useShowImages = (): boolean => usePrefs().showImages;
