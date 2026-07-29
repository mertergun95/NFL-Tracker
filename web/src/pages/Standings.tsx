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

const DIVISIONS = ["AFC East", "AFC North", "AFC South", "AFC West",
                   "NFC East", "NFC North", "NFC South", "NFC West"];

interface Row extends StatRow {
  pct: number; diff: number;
}

export default function Standings({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(() => loadTeamSeason(season), [season]);

  const byDivision = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const div of DIVISIONS) map.set(div, []);
    for (const r of data ?? []) {
      const abbr = String(r.team);
      const div = TEAMS[abbr]?.division;
      if (!div) continue;
      const w = Number(r.wins ?? 0), l = Number(r.losses ?? 0), t = Number(r.ties ?? 0);
      const games = w + l + t;
      map.get(div)?.push({
        ...r,
        pct: games ? (w + t / 2) / games : 0,
        diff: Number(r.points_for ?? 0) - Number(r.points_against ?? 0),
      });
    }
    for (const rows of map.values())
      rows.sort((a, b) => b.pct - a.pct || b.diff - a.diff);
    return map;
  }, [data]);

  return (
    <section>
      <h1>{t("standings.title")}</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="standings-grid">
        {DIVISIONS.map((div) => (
          <div className="standings-card" key={div}>
            <h3>{div}</h3>
            <table className="stat-table">
              <thead>
                <tr>
                  <th>{label("team")}</th><th>{label("wins")}</th><th>{label("losses")}</th><th>{label("ties")}</th>
                  <th>Pct</th><th>AS</th><th>YS</th><th>Fark</th>
                </tr>
              </thead>
              <tbody>
                {(byDivision.get(div) ?? []).map((r) => (
                  <tr key={String(r.team)}>
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
                      color: r.diff > 0 ? "#3fb950" : r.diff < 0 ? "#f0883e" : undefined,
                    }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
