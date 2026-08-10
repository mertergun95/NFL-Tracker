/** Uygulama, veriyi kendi içinde taşımaz: statgrade.com'un yayınladığı statik
 *  JSON'ları okur. Böylece Salı sabahı pipeline çalışıp GitHub Pages'e deploy
 *  ettiğinde uygulama da mağaza güncellemesi olmadan yeni veriyi görür. */
import Constants from "expo-constants";

const configured = (Constants.expoConfig?.extra as { dataBaseUrl?: string } | undefined)
  ?.dataBaseUrl;

/** Geliştirirken yerel pipeline çıktısına bakmak için:
 *  EXPO_PUBLIC_DATA_BASE_URL=http://192.168.1.5:8090 npx expo start */
const override = process.env.EXPO_PUBLIC_DATA_BASE_URL;

/** Veri kökü (sonda eğik çizgi yok). */
export const SITE_URL: string =
  (override || configured || "https://statgrade.com").replace(/\/$/, "");
export const DATA_URL = `${SITE_URL}/data`;

/** Taze veri sayılan süre; bundan eskisi arka planda yenilenir. */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Ağ isteği zaman aşımı (ms). Mobil şebekede takılı kalmasın. */
export const FETCH_TIMEOUT_MS = 30_000;
