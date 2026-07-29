import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import { loadNcaaTeams, loadNcaaTeamSeason, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import type { StatRow } from "../../lib/types";
import { label } from "../../lib/columns";
import { translate, useT } from "../../lib/i18n";

export default function NcaaStandings({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(
    () => loadNcaaTeamSeason(season), [season]);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const conferences = useMemo(() => {
    const m = new Map<string, StatRow[]>();
    for (const row of data ?? []) {
      const conf = String(row.conference ?? translate("ncaa.other"));
      if (!m.has(conf)) m.set(conf, []);
      m.get(conf)!.push(row);
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
      <h1>{t("ncaa.standingsTitle")}</h1>
      <p className="sub">{t("ncaa.standingsSub")}</p>
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
                  <th>{t("common.team")}</th><th>{label("wins")}</th>
                  <th>{label("losses")}</th><th>{t("ncaa.confShort")}</th>
                  <th>{label("points_pg")}</th><th>{label("points_allowed_pg")}</th>
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
