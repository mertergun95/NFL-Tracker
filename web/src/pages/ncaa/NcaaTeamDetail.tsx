import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import PName from "../../components/PName";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaNextSchedule, loadNcaaPlayerSeason, loadNcaaSchedule,
         loadNcaaTeams, loadNcaaTeamSeason, loadNcaaTeamWeeks,
         teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { kickoffBerlin } from "../../lib/time";

export default function NcaaTeamDetail({ seasons }: { seasons: number[] }) {
  const { abbr } = useParams<{ abbr: string }>();
  const [season, setSeason] = useState(seasons[0]);

  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const info = useMemo(() => teamMapOf(teams).get(String(abbr)), [teams, abbr]);

  const { data: ts } = useAsync(async () => {
    const rows = await loadNcaaTeamSeason(season);
    return rows.find((r) => r.team === abbr) ?? null;
  }, [abbr, season]);

  const { data: sched, error, loading } = useAsync(async () => {
    const rows = await loadNcaaSchedule(season);
    return rows.filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week)
        || String(a.season_type).localeCompare(String(b.season_type)));
  }, [abbr, season]);

  const { data: tw } = useAsync(async () => {
    const rows = await loadNcaaTeamWeeks(season);
    return rows.filter((r) => r.team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [abbr, season]);

  const { data: roster } = useAsync(async () => {
    const rows = await loadNcaaPlayerSeason(season);
    return rows.filter((r) => r.team === abbr);
  }, [abbr, season]);

  // Yeni sezon fikstürü (varsa)
  const { data: nextFix } = useAsync(async () => {
    const rows = await loadNcaaNextSchedule();
    if (!rows) return null;
    return rows.filter((g) => (g.home_team === abbr || g.away_team === abbr)
                              && g.home_score === null)
      .sort((a, b) => String(a.gameday).localeCompare(String(b.gameday)));
  }, [abbr]);

  return (
    <section>
      <div className="player-header">
        <NcaaLogo src={info?.logo} size={64} />
        <div>
          <h1>{info?.name ?? String(abbr)}</h1>
          <p className="sub">
            {info?.conference ?? "—"}
            {ts && <> · {String(ts.wins)}–{String(ts.losses)}
              {ts.conf_wins !== null && ts.conf_wins !== undefined &&
                ` (konferans ${ts.conf_wins}–${ts.conf_losses})`}
              {" · "}{String(ts.points_pg)} sayı/maç,
              {" "}{String(ts.points_allowed_pg)} yenilen/maç</>}
          </p>
        </div>
      </div>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}

      <h2>Fikstür ({season})</h2>
      <div className="game-grid">
        {(sched ?? []).map((g) => {
          const home = g.home_team === abbr;
          const opp = home ? g.away_team : g.home_team;
          const us = Number(home ? g.home_score : g.away_score);
          const them = Number(home ? g.away_score : g.home_score);
          const played = g.home_score !== null;
          return (
            <div className="game-card" key={String(g.game_id)}>
              <div className="game-date">
                W{String(g.week)} · {String(g.season_type)} · {String(g.gameday)}
              </div>
              <div className="game-line">
                <Link to={`/ncaa/team/${opp}`} className="team-cell">
                  {home ? "vs" : "@"} {String(opp)}
                </Link>
                {played && (
                  <strong style={{ color: us > them ? "#3fb950" : "#f85149" }}>
                    {us > them ? "G" : "M"} {us}–{them}
                  </strong>
                )}
              </div>
              <Link className="drawer-link" style={{ marginTop: 4 }}
                    to={`/ncaa/game/${season}/${g.game_id}`}>
                Maç detayı →
              </Link>
            </div>
          );
        })}
      </div>

      {nextFix && nextFix.length > 0 && (
        <>
          <h2>📅 {String(nextFix[0].season)} Fikstürü</h2>
          <div className="game-grid">
            {nextFix.map((g) => {
              const home = g.home_team === abbr;
              const opp = home ? g.away_team : g.home_team;
              return (
                <div className="game-card" key={String(g.game_id)}>
                  <div className="game-date">
                    W{String(g.week)} · {String(g.season_type)} · {String(g.gameday)}
                    {kickoffBerlin(g.kickoff as string) &&
                      ` · 🕐 ${kickoffBerlin(g.kickoff as string)} (DE)`}
                  </div>
                  <div className="game-line">
                    <Link to={`/ncaa/team/${opp}`} className="team-cell">
                      {home ? "vs" : "@"} {String(opp)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tw && tw.length > 0 && (
        <>
          <h2>Maç Bazlı Takım İstatistikleri</h2>
          <StatTable rows={tw}
            columns={["week", "season_type", "opponent", "points",
                      "points_allowed", "total_yards", "passing_yards",
                      "rushing_yards", "third_down_pct", "turnovers"]}
            defaultSort="week"
            render={{
              opponent: (r) => (
                <Link to={`/ncaa/team/${r.opponent}`}>
                  {String(r.opponent ?? "—")}
                </Link>
              ),
            }} />
        </>
      )}

      {roster && roster.length > 0 && (
        <>
          <h2>Oyuncu Sezon İstatistikleri ({season}, REG)</h2>
          <StatTable rows={roster}
            columns={["player_name", "position", "games", "passing_yards",
                      "passing_tds", "carries", "rushing_yards", "rushing_tds",
                      "receptions", "receiving_yards", "receiving_tds"]}
            defaultSort="rushing_yards"
            render={{
              player_name: (r) => (
                <PName name={String(r.player_name)}
                       pos={String(r.position ?? "")}
                       id={String(r.player_id)} base="/ncaa/player" />
              ),
            }} />
        </>
      )}
    </section>
  );
}
