import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadSchedule } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";

export default function Games({ seasons }: { seasons: number[] }) {
  const navigate = useNavigate();
  const [season, setSeason] = useState(seasons[0]);
  const [week, setWeek] = useState(1);
  const { data, error, loading } = useAsync(() => loadSchedule(season), [season]);

  const weeks = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((g) => Number(g.week)))].sort((a, b) => a - b);
  }, [data]);

  const games = useMemo(
    () => (data ?? []).filter((g) => Number(g.week) === week),
    [data, week],
  );

  return (
    <section>
      <h1>Maçlar</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      <div className="pill-row">
        {weeks.map((w) => (
          <button key={w} className={`pill small ${w === week ? "active" : ""}`}
                  onClick={() => setWeek(w)}>
            {w}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="game-grid">
        {games.map((g) => {
          const played = g.home_score !== null;
          return (
            <div className="game-card" key={String(g.game_id)}
                 onClick={() => navigate(`/game/${season}/${g.game_id}`)}>
              <div className="game-date">{String(g.gameday)} · {String(g.game_type)}</div>
              <div className="game-line">
                <Link to={`/team/${g.away_team}`} className="team-cell">
                  <TeamLogo abbr={String(g.away_team)} size={20} />{" "}
                  {teamName(String(g.away_team))}
                </Link>
                <strong>{played ? String(g.away_score) : ""}</strong>
              </div>
              <div className="game-line">
                <Link to={`/team/${g.home_team}`} className="team-cell">
                  <TeamLogo abbr={String(g.home_team)} size={20} />{" "}
                  {teamName(String(g.home_team))}
                </Link>
                <strong>{played ? String(g.home_score) : ""}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
