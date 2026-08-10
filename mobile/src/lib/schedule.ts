/** Hafta etiketleri.
 *
 * Playoff haftalarını numarayla göstermek (19–22) okunmuyordu: kimse
 * "hafta 21"i Conference Championship diye tanımıyor. nflverse'te bu bilgi
 * zaten game_type'ta var (WC / DIV / CON / SB), o yüzden numara yerine üç
 * harfli kısaltma gösteriliyor; tam adı i18n'den başlık (title) olarak.
 */
import { translate } from "./i18n";

/** game_type -> üç harfli kısaltma (lig genelinde kullanılan biçim) */
export const ROUND_ABBR: Record<string, string> = {
  WC: "WLD", DIV: "DIV", CON: "CH", SB: "SB",
};

/** game_type -> tam ad için i18n anahtarı */
const ROUND_KEY: Record<string, string> = {
  WC: "round.wildcard", DIV: "round.divisional",
  CON: "round.conference", SB: "round.superbowl",
};

export const isPlayoff = (gameType: string): boolean => gameType in ROUND_ABBR;

/** Hafta seçicide ve satırlarda görünen kısa etiket. */
export function weekLabel(week: number, gameType?: string | null): string {
  if (gameType && ROUND_ABBR[gameType]) return ROUND_ABBR[gameType];
  return String(week);
}

/** Kısaltmanın açılımı (tooltip / erişilebilirlik). */
export function weekTitle(week: number, gameType?: string | null): string {
  if (gameType && ROUND_KEY[gameType]) return translate(ROUND_KEY[gameType]);
  return translate("common.week") + " " + week;
}

/** Bir haftanın game_type'ı: o haftaya ait ilk maçtan okunur. */
export function typeOfWeek(
  rows: Record<string, unknown>[], week: number,
): string | null {
  const g = rows.find((r) => Number(r.week) === week);
  return g ? String(g.game_type) : null;
}
