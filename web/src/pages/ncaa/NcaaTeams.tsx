import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaTeams, loadNcaaTeamSeason, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";

const COLS = ["wins", "losses", "points_pg", "points_allowed_pg",
              "total_yards_pg", "passing_yards_pg", "rushing_yards_pg",
              "third_down_pct_pg", "turnovers_pg"];

export default function NcaaTeams({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const [q, setQ] = useState("");
  const { data, error, loading } = useAsync(
    () => loadNcaaTeamSeason(season), [season]);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((t) =>
      String(t.team).toLowerCase().includes(s)
      || (tmap.get(String(t.team))?.school ?? "").toLowerCase().includes(s)
      || String(t.conference ?? "").toLowerCase().includes(s));
  }, [data, q, tmap]);

  return (
    <section>
      <h1>NCAA Takımları</h1>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <input className="axis-select" placeholder="Okul / konferans ara…"
               value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <StatTable rows={rows}
          columns={["team", "conference", "games", ...COLS]}
          defaultSort="wins"
          render={{
            team: (r) => (
              <Link to={`/ncaa/team/${r.team}`} className="team-cell">
                <NcaaLogo src={tmap.get(String(r.team))?.logo} size={20} />
                {" "}{tmap.get(String(r.team))?.school ?? String(r.team)}
              </Link>
            ),
          }} />
      )}
    </section>
  );
}
