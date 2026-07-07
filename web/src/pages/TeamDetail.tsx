import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadPlayerSeason, loadSchedule } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS, teamName } from "../lib/teams";
import { POSITION_PRESETS } from "../lib/columns";

export default function TeamDetail({ seasons }: { seasons: number[] }) {
  const { abbr } = useParams<{ abbr: string }>();
  const [season, setSeason] = useState(seasons[0]);
  const info = abbr ? TEAMS[abbr] : undefined;

  const { data: sched, error: schedErr, loading } = useAsync(async () => {
    const rows = await loadSchedule(season);
    return rows
      .filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((g) => {
        const home = g.home_team === abbr;
        const us = Number(home ? g.home_score : g.away_score);
        const them = Number(home ? g.away_score : g.home_score);
        const played = g.home_score !== null && g.away_score !== null;
        return {
          week: g.week, game_type: g.game_type, gameday: g.gameday,
          opponent: home ? g.away_team : g.home_team,
          where: home ? "Ev" : "Dep",
          score: played ? `${us}-${them}` : "—",
          result: played ? (us > them ? "G" : us < them ? "M" : "B") : "—",
        };
      });
  }, [abbr, season]);

  const { data: roster } = useAsync(async () => {
    const rows = await loadPlayerSeason(season);
    return rows.filter((p) => p.team === abbr);
  }, [abbr, season]);

  const topReceivers = useMemo(
    () => roster?.filter((p) => Number(p.targets ?? 0) > 0) ?? [],
    [roster],
  );

  return (
    <section>
      <h1 style={{ borderLeft: `6px solid ${info?.color ?? "#888"}`, paddingLeft: 12 }}>
        {teamName(abbr ?? null)}
      </h1>
      <p className="sub">{info?.division ?? ""}</p>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />

      <h2>Maçlar</h2>
      {loading && <Loading />}
      {schedErr && <ErrorMsg msg={schedErr} />}
      {sched && (
        <StatTable rows={sched}
          columns={["week", "game_type", "gameday", "opponent", "where", "score", "result"]}
          defaultSort="week"
          render={{
            opponent: (row) => (
              <Link to={`/team/${row.opponent}`}>{String(row.opponent)}</Link>
            ),
          }}
        />
      )}

      <h2>Kadro — Sezon İstatistikleri</h2>
      {roster && (
        <StatTable rows={topReceivers}
          columns={["player_name", "position", "games", ...POSITION_PRESETS.WR]}
          defaultSort="receiving_yards" maxRows={40}
          render={{
            player_name: (row) => (
              <Link to={`/player/${row.player_id}`}>{String(row.player_name)}</Link>
            ),
          }}
        />
      )}
    </section>
  );
}
