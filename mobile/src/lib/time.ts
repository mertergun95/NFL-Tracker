/** Maç saatleri.
 *
 *  Web sürümü herkese Europe/Berlin gösteriyor; telefonda doğrusu cihazın
 *  kendi saat dilimidir, o yüzden Intl'e timeZone verilmez (yerel saat).
 *  Kaynak veri Doğu saatiyle (ET) geldiği için önce ET ofseti o günden
 *  hesaplanıp UTC'ye çevrilir, sonra cihaz saatine biçimlenir.
 */
import { getLang, translate } from "./i18n";

const LOCALE: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE" };
const locale = () => LOCALE[getLang()] ?? "en-US";

/** Intl, Hermes'te motor/derleme kombinasyonuna göre eksik olabiliyor.
 *  Biçimleyici kurulamazsa uygulama çökmemeli — sade bir karşılığa düşülür. */
function tryFormat(d: Date, opts: Intl.DateTimeFormatOptions, fallback: string): string {
  try {
    return new Intl.DateTimeFormat(locale(), opts).format(d);
  } catch {
    return fallback;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

function fmtLocal(utc: Date, withDate: boolean): string {
  const time = tryFormat(utc, { hour: "2-digit", minute: "2-digit" },
                         `${pad(utc.getHours())}:${pad(utc.getMinutes())}`);
  if (!withDate) return time;
  const date = tryFormat(utc, { weekday: "short", day: "2-digit", month: "2-digit" },
                         `${pad(utc.getDate())}.${pad(utc.getMonth() + 1)}`);
  return `${date} ${time}`;
}

/** ISO UTC kickoff ("2026-08-29T16:00Z") -> cihaz saatinde metin. */
export function kickoffLocal(
  iso: string | number | null | undefined, withDate = false,
): string | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return null;
  return fmtLocal(d, withDate);
}

/** NFL: gameday + gametime (ET, ör. "20:20") -> cihaz saati.
 *  ET ofseti (EDT/EST) o günün kendisinden hesaplanır. */
export function etLocal(
  gameday: string | number | null | undefined,
  gametime: string | number | null | undefined,
  withDate = false,
): string | null {
  const utc = etToUtc(gameday, gametime);
  return utc ? fmtLocal(utc, withDate) : null;
}

/** ET gün+saatinden UTC Date üretir (kickoff'a kalan süre hesabı için). */
export function etToUtc(
  gameday: string | number | null | undefined,
  gametime: string | number | null | undefined,
): Date | null {
  if (!gameday || !gametime) return null;
  const day = String(gameday);
  const m = String(gametime).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  // O gün öğlen UTC anında New York'ta saat kaç? -> ET ofseti (4=EDT, 5=EST)
  const probe = new Date(`${day}T12:00:00Z`);
  if (isNaN(probe.getTime())) return null;
  let offset: number;
  try {
    const etHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", hour: "numeric", hour12: false,
      }).format(probe),
    );
    if (!Number.isFinite(etHour)) throw new Error("no tz");
    offset = 12 - etHour;
  } catch {
    // Saat dilimi verisi yoksa kabaca yaz saati kuralı: Mart–Kasım EDT (4).
    const month = Number(day.slice(5, 7));
    offset = month >= 3 && month <= 11 ? 4 : 5;
  }
  const [y, mo, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, Number(m[1]) + offset, Number(m[2])));
  return isNaN(utc.getTime()) ? null : utc;
}

/** "12 Ağustos Salı" gibi uzun tarih (gün başlıkları). */
export function dayLabel(gameday: string | number | null | undefined): string {
  if (!gameday) return "—";
  const d = new Date(`${String(gameday)}T12:00:00Z`);
  if (isNaN(d.getTime())) return String(gameday);
  return tryFormat(d, { weekday: "long", day: "2-digit", month: "long" },
                   String(gameday));
}

/** "3 gün önce" tarzı bağıl zaman — veri tazeliği satırında kullanılır.
 *
 *  Intl.RelativeTimeFormat kullanılmıyor: Hermes'in Android derlemelerinde
 *  bu API her zaman bulunmuyor ve burası ilk render'da çalıştığı için
 *  eksikliği uygulamayı açılışta düşürür. Üç dil için sözlükten kuruluyor.
 */
export function relativeTime(ts: number | null): string {
  if (!ts) return "—";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return translate("time.justNow");
  if (mins < 60) return translate("time.minutesAgo", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return translate("time.hoursAgo", { n: hours });
  return translate("time.daysAgo", { n: Math.round(hours / 24) });
}
