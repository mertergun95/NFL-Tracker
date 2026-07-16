/** Maç saatlerini Almanya (Europe/Berlin) saatine çevirir. */

const BERLIN = "Europe/Berlin";

function fmtBerlin(utc: Date, withDate: boolean): string {
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN, hour: "2-digit", minute: "2-digit",
  }).format(utc);
  if (!withDate) return time;
  const date = new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN, weekday: "short", day: "2-digit", month: "2-digit",
  }).format(utc);
  return `${date} ${time}`;
}

/** NCAA: ISO UTC kickoff ("2026-08-29T16:00Z") -> "Sa., 29.08. 18:00". */
export function kickoffBerlin(iso: string | number | null | undefined,
                              withDate = false): string | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return null;
  return fmtBerlin(d, withDate);
}

/** NFL: gameday + gametime (Doğu saati, ör. "20:20") -> Berlin saati.
    ET ofseti (EDT/EST) o günün kendisinden hesaplanır. */
export function etBerlin(gameday: string | number | null | undefined,
                         gametime: string | number | null | undefined,
                         withDate = false): string | null {
  if (!gameday || !gametime) return null;
  const day = String(gameday), t = String(gametime);
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  // O gün öğlen UTC anında New York'ta saat kaç? -> ET ofseti (4=EDT, 5=EST)
  const probe = new Date(`${day}T12:00:00Z`);
  if (isNaN(probe.getTime())) return null;
  const etHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", hour12: false,
  }).format(probe));
  const offset = 12 - etHour;
  const [y, mo, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d,
                                Number(m[1]) + offset, Number(m[2])));
  return fmtBerlin(utc, withDate);
}
