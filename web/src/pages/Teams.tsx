import { useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadTeamSeason } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";

const COLS = [
  "team", "wins", "losses", "ties", "points_for", "points_against",
  "passing_yards", "passing_tds", "rushing_yards", "rushing_tds",
  "passing_interceptions", "def_sacks",
];

export default function Teams({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(() => loadTeamSeason(season), [season]);

  return (
    <section>
      <h1>Takım İstatistikleri</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <StatTable rows={data} columns={COLS} defaultSort="wins"
          render={{
            team: (row) => (
              <Link to={`/team/${row.team}`}>{teamName(String(row.team))}</Link>
            ),
          }}
        />
      )}
    </section>
  );
}
