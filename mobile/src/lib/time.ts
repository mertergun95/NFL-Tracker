/** Maç saatleri.
 *
 *  Web sürümü herkese Europe/Berlin gösteriyor; telefonda doğrusu cihazın
 *  kendi saat dilimidir, o yüzden Intl'e timeZone verilmez (yerel saat).
 *  Kaynak veri Doğu saatiyle (ET) geldiği için önce ET ofseti o günden
 *  hesaplanıp UTC'ye çevrilir, sonra cihaz saatine biçimlenir.
 */
import { getLang } from "./i18n";

const LOCALE: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE" };
const locale = () => LOCALE[getLang()] ?? "en-US";

function fmtLocal(utc: Date, withDate: boolean): string {
  const time = new Intl.DateTimeFormat(locale(), {
    hour: "2-digit", minute: "2-digit",
  }).format(utc);
  if (!withDate) return time;
  const date = new Intl.DateTimeFormat(locale(), {
    weekday: "short", day: "2-digit", month: "2-digit",
  }).format(utc);
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
  const etHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", hour12: false,
    }).format(probe),
  );
  const offset = 12 - etHour;
  const [y, mo, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, Number(m[1]) + offset, Number(m[2])));
  return isNaN(utc.getTime()) ? null : utc;
}

/** "12.08.2026" gibi kısa tarih (gün başlıkları). */
export function dayLabel(gameday: string | number | null | undefined): string {
  if (!gameday) return "—";
  const d = new Date(`${String(gameday)}T12:00:00Z`);
  if (isNaN(d.getTime())) return String(gameday);
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long", day: "2-digit", month: "long",
  }).format(d);
}

/** "3 gün önce" tarzı bağıl zaman — veri tazeliği rozetinde kullanılır. */
export function relativeTime(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}
