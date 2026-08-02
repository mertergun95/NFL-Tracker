import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadTeamSeason } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS } from "../lib/teams";
import type { StatRow } from "../lib/types";
import { label } from "../lib/columns";
import { useT } from "../lib/i18n";

const CONFERENCES = ["AFC", "NFC"] as const;
const DIVISIONS: Record<string, string[]> = {
  AFC: ["AFC East", "AFC North", "AFC South", "AFC West"],
  NFC: ["NFC East", "NFC North", "NFC South", "NFC West"],
};

// Playoff formatı: konferans başına 4 divizyon şampiyonu (1–4) + 3 wild card
// (5–7). Şampiyonluk tablosu bu sıralamayı tek listede gösterir.
const DIV_WINNERS = 4;
const PLAYOFF_SPOTS = 7;

interface Row extends StatRow {
  pct: number; diff: number; conf: string; div: string;
}

function buildRows(data: StatRow[] | null): Row[] {
  const out: Row[] = [];
  for (const r of data ?? []) {
    const div = TEAMS[String(r.team)]?.division;
    if (!div) continue;
    const w = Number(r.wins ?? 0), l = Number(r.losses ?? 0), tie = Number(r.ties ?? 0);
    const games = w + l + tie;
    out.push({
      ...r,
      conf: div.slice(0, 3),
      div,
      pct: games ? (w + tie / 2) / games : 0,
      diff: Number(r.points_for ?? 0) - Number(r.points_against ?? 0),
    });
  }
  return out;
}

const byRecord = (a: Row, b: Row) => b.pct - a.pct || b.diff - a.diff;

/** Konferans sıralaması: önce divizyon şampiyonları (kendi aralarında
 *  yüzdeye göre), sonra kalanlar. Gerçek NFL tie-break kuralları (kafa
 *  kafaya, divizyon içi, ortak rakip…) bu veriyle hesaplanamıyor; burada
 *  galibiyet yüzdesi ve averaj kullanılıyor. */
function seedConference(rows: Row[]): Row[] {
  const winners: Row[] = [];
  for (const div of DIVISIONS[rows[0]?.conf] ?? []) {
    const top = rows.filter((r) => r.div === div).sort(byRecord)[0];
    if (top) winners.push(top);
  }
  const rest = rows.filter((r) => !winners.includes(r)).sort(byRecord);
  return [...winners.sort(byRecord), ...rest];
}

function StandingsTable({ rows, seeded }: { rows: Row[]; seeded?: boolean }) {
  const t = useT();
  return (
    <table className="stat-table">
      <thead>
        <tr>
          {/* sayısal başlıklar da sağa yaslanır — hücreleriyle aynı hizada */}
          {seeded && <th className="seed-col num">#</th>}
          <th>{label("team")}</th>
          <th className="num">{label("wins")}</th>
          <th className="num">{label("losses")}</th>
          <th className="num">{label("ties")}</th>
          <th className="num" title={t("stand.pctTitle")}>Pct</th>
          <th className="num" title={t("stand.pfTitle")}>{t("stand.pf")}</th>
          <th className="num" title={t("stand.paTitle")}>{t("stand.pa")}</th>
          <th className="num" title={t("stand.diffTitle")}>{t("stand.diff")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={String(r.team)}
              className={seeded && i === PLAYOFF_SPOTS - 1 ? "seed-cut" : ""}>
            {seeded && (
              <td className={`num seed-col ${i < DIV_WINNERS ? "seed-div" : ""}`}>
                {i + 1}
              </td>
            )}
            <td>
              <Link to={`/team/${r.team}`} className="team-cell">
                <TeamLogo abbr={String(r.team)} size={18} /> {String(r.team)}
              </Link>
            </td>
            <td className="num">{String(r.wins ?? 0)}</td>
            <td className="num">{String(r.losses ?? 0)}</td>
            <td className="num">{String(r.ties ?? 0)}</td>
            <td className="num">{r.pct.toFixed(3).replace(/^0/, "")}</td>
            <td className="num">{String(r.points_for ?? "—")}</td>
            <td className="num">{String(r.points_against ?? "—")}</td>
            <td className="num" style={{
              color: r.diff > 0 ? "var(--good)"
                : r.diff < 0 ? "var(--neutral-warm)" : undefined,
            }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Standings({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const [view, setView] = useState<"division" | "conference">("division");
  const { data, error, loading } = useAsync(() => loadTeamSeason(season), [season]);

  const rows = useMemo(() => buildRows(data), [data]);
  const byConf = useMemo(() => {
    const m: Record<string, Row[]> = { AFC: [], NFC: [] };
    for (const r of rows) m[r.conf]?.push(r);
    return m;
  }, [rows]);

  return (
    <section>
      <h1>{t("standings.title")}</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      <div className="pill-row">
        <button className={`pill ${view === "division" ? "active" : ""}`}
                onClick={() => setView("division")}>{t("stand.byDivision")}</button>
        <button className={`pill ${view === "conference" ? "active" : ""}`}
                onClick={() => setView("conference")}>{t("stand.byConference")}</button>
      </div>
      {view === "conference" && <p className="sub">{t("stand.seedNote")}</p>}
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}

      {CONFERENCES.map((conf) => (
        <div className="conf-block" key={conf}>
          <h2 className={`conf-head conf-${conf.toLowerCase()}`}>{conf}</h2>
          {view === "division" ? (
            <div className="standings-grid">
              {DIVISIONS[conf].map((div) => (
                <div className="standings-card" key={div}>
                  <h3>{div}</h3>
                  <StandingsTable
                    rows={rows.filter((r) => r.div === div).sort(byRecord)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="standings-card">
              <StandingsTable rows={seedConference(byConf[conf] ?? [])} seeded />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
