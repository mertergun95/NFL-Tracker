import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import { loadNcaaTeams, loadNcaaTeamSeason, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import type { StatRow } from "../../lib/types";

export default function NcaaStandings({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(
    () => loadNcaaTeamSeason(season), [season]);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const conferences = useMemo(() => {
    const m = new Map<string, StatRow[]>();
    for (const t of data ?? []) {
      const conf = String(t.conference ?? "Diğer");
      if (!m.has(conf)) m.set(conf, []);
      m.get(conf)!.push(t);
    }
    for (const rows of m.values())
      rows.sort((a, b) =>
        Number(b.conf_wins ?? 0) - Number(a.conf_wins ?? 0)
        || Number(b.wins) - Number(a.wins)
        || Number(b.points_pg) - Number(a.points_pg));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <section>
      <h1>NCAA Puan Durumu</h1>
      <p className="sub">Konferanslara göre W-L (bowl/playoff dahil).</p>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="standings-grid">
        {conferences.map(([conf, rows]) => (
          <div className="standings-card" key={conf}>
            <h3>{conf}</h3>
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Takım</th><th>W</th><th>L</th>
                  <th>Konf</th><th>PF/m</th><th>PA/m</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={String(t.team)}>
                    <td>
                      <Link to={`/ncaa/team/${t.team}`} className="team-cell">
                        <NcaaLogo src={tmap.get(String(t.team))?.logo} size={18} />
                        {" "}{tmap.get(String(t.team))?.school ?? String(t.team)}
                      </Link>
                    </td>
                    <td className="num">{String(t.wins)}</td>
                    <td className="num">{String(t.losses)}</td>
                    <td className="num">
                      {t.conf_wins !== null && t.conf_wins !== undefined
                        ? `${t.conf_wins}–${t.conf_losses}` : "—"}
                    </td>
                    <td className="num">{String(t.points_pg)}</td>
                    <td className="num">{String(t.points_allowed_pg)}</td>
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
