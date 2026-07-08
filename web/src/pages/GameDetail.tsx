import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import TeamLogo from "../components/TeamLogo";
import { ErrorMsg, Loading } from "../components/Pickers";
import { loadPlayerWeeks, loadSchedule, loadTeamWeeks } from "../lib/data";
import { label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";

const PLAYER_COLS = [
  "player_name", "position", "completions", "attempts", "passing_yards",
  "passing_tds", "passing_interceptions", "carries", "rushing_yards",
  "rushing_tds", "targets", "receptions", "receiving_yards", "receiving_tds",
  "fantasy_points_ppr",
];

const TEAM_COMPARE_COLS = [
  "completions", "attempts", "passing_yards", "passing_tds",
  "passing_interceptions", "sacks_suffered", "carries", "rushing_yards",
  "rushing_tds", "receptions", "targets", "def_sacks", "def_interceptions",
];

function TeamPlayerTable({ rows, team }: { rows: StatRow[]; team: string }) {
  const teamRows = rows
    .filter((r) => r.team === team && Number(r.fantasy_points_ppr ?? 0) !== 0);
  return (
    <>
      <h2><Link to={`/team/${team}`}>{teamName(team)}</Link> — Oyuncular</h2>
      <StatTable rows={teamRows} columns={PLAYER_COLS}
        defaultSort="fantasy_points_ppr" maxRows={30}
        render={{
          player_name: (row) => (
            <Link to={`/player/${row.player_id}`}>{String(row.player_name)}</Link>
          ),
        }}
      />
    </>
  );
}

export default function GameDetail() {
  const { season = "", gameId = "" } = useParams<{ season: string; gameId: string }>();

  const { data: game, error } = useAsync(async () => {
    const rows = await loadSchedule(season);
    return rows.find((g) => g.game_id === gameId) ?? null;
  }, [season, gameId]);

  const week = game ? Number(game.week) : null;
  const type = game ? (game.game_type === "REG" ? "REG" : "POST") : null;
  const home = String(game?.home_team ?? "");
  const away = String(game?.away_team ?? "");

  const { data: players, loading } = useAsync(async () => {
    if (week === null) return null;
    const rows = await loadPlayerWeeks(season);
    return rows.filter((r) => Number(r.week) === week && r.season_type === type
      && (r.team === home || r.team === away));
  }, [season, week, home, away]);

  const { data: teamWeeks } = useAsync(async () => {
    if (week === null) return null;
    const rows = await loadTeamWeeks(season);
    return rows.filter((r) => Number(r.week) === week && r.season_type === type
      && (r.team === home || r.team === away));
  }, [season, week, home, away]);

  const compare = useMemo(() => {
    if (!teamWeeks) return [];
    const h = teamWeeks.find((r) => r.team === home);
    const a = teamWeeks.find((r) => r.team === away);
    if (!h || !a) return [];
    return TEAM_COMPARE_COLS
      .filter((c) => h[c] !== undefined || a[c] !== undefined)
      .map((c) => ({ stat: label(c), away: a[c] ?? "—", home: h[c] ?? "—" }));
  }, [teamWeeks, home, away]);

  if (error) return <ErrorMsg msg={error} />;
  if (!game) return <Loading />;
  const played = game.home_score !== null;

  return (
    <section>
      <p className="sub">
        {String(game.gameday)} · {String(game.game_type)} · Hafta {String(game.week)}
        {game.stadium ? ` · ${game.stadium}` : ""}
      </p>
      <div className="game-hero">
        <div>
          <TeamLogo abbr={away} size={44} />
          <Link to={`/team/${away}`}>{teamName(away)}</Link>
          <strong>{played ? String(game.away_score) : "—"}</strong>
        </div>
        <span className="game-at">@</span>
        <div>
          <TeamLogo abbr={home} size={44} />
          <Link to={`/team/${home}`}>{teamName(home)}</Link>
          <strong>{played ? String(game.home_score) : "—"}</strong>
        </div>
      </div>

      {!played && <p className="empty">Bu maç henüz oynanmadı.</p>}

      {played && compare.length > 0 && (
        <>
          <h2>Takım Karşılaştırması</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr><th>{away}</th><th>İstatistik</th><th>{home}</th></tr>
              </thead>
              <tbody>
                {compare.map((r) => (
                  <tr key={r.stat}>
                    <td className="num">{String(r.away)}</td>
                    <td style={{ textAlign: "center" }}>{r.stat}</td>
                    <td className="num">{String(r.home)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && <Loading />}
      {played && players && (
        <>
          <TeamPlayerTable rows={players} team={away} />
          <TeamPlayerTable rows={players} team={home} />
        </>
      )}
    </section>
  );
}
