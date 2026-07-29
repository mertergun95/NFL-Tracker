import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import PName from "../../components/PName";
import { ErrorMsg, Loading } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { label } from "../../lib/columns";
import { loadNcaaPlayerWeeks, loadNcaaSchedule, loadNcaaTeams,
         loadNcaaTeamWeeks, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { kickoffBerlin } from "../../lib/time";
import type { StatRow } from "../../lib/types";
import { useT } from "../../lib/i18n";

const TEAM_ROWS = ["first_downs", "total_yards", "passing_yards",
                   "rushing_yards", "rushing_attempts", "yards_per_pass",
                   "yards_per_rush", "third_down_pct", "turnovers",
                   "possession_sec"];

function fmtVal(col: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (col === "possession_sec") {
    const s = Number(v);
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  }
  return String(v);
}

function BoxTable({ rows, title, cols, filter }:
  { rows: StatRow[]; title: string; cols: string[];
    filter: (r: StatRow) => boolean }) {
  const filtered = rows.filter(filter);
  if (filtered.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <StatTable rows={filtered}
        columns={["player_name", ...cols]} defaultSort={cols[1] ?? cols[0]}
        render={{
          player_name: (r) => (
            <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                   id={String(r.player_id)} base="/ncaa/player" />
          ),
        }} />
    </>
  );
}

export default function NcaaGameDetail() {
  const t = useT();
  const { season, gameId } = useParams<{ season: string; gameId: string }>();

  const { data: game, error, loading } = useAsync(async () => {
    const rows = await loadNcaaSchedule(season!);
    return rows.find((g) => String(g.game_id) === gameId) ?? null;
  }, [season, gameId]);

  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const { data: tw } = useAsync(async () => {
    const rows = await loadNcaaTeamWeeks(season!);
    return rows.filter((r) => String(r.game_id) === gameId);
  }, [season, gameId]);

  const { data: pw } = useAsync(async () => {
    const rows = await loadNcaaPlayerWeeks(season!);
    return rows.filter((r) => String(r.game_id) === gameId);
  }, [season, gameId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMsg msg={error} />;
  if (!game) return <p className="empty">{t("game.notFound")}</p>;

  const sides = [String(game.away_team), String(game.home_team)];
  const twOf = (t: string) => tw?.find((r) => r.team === t) ?? null;

  return (
    <section>
      <div className="game-hero">
        {sides.map((t, i) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center",
                                 gap: 8 }}>
            <NcaaLogo src={tmap.get(t)?.logo} size={40} />
            <Link to={`/ncaa/team/${t}`}>
              <h1 style={{ display: "inline" }}>{tmap.get(t)?.school ?? t}</h1>
            </Link>
            <h1 style={{ display: "inline" }}>
              {String(i === 0 ? game.away_score ?? "" : game.home_score ?? "")}
            </h1>
            {i === 0 && <span className="game-at">@</span>}
          </span>
        ))}
      </div>
      <p className="sub">
        {String(game.gameday)} · {String(game.season_type)} W{String(game.week)}
        {kickoffBerlin(game.kickoff as string) &&
          ` · 🕐 ${kickoffBerlin(game.kickoff as string)} (DE)`}
        {Boolean(game.neutral_site) && t("game.neutral")}
        {Boolean(game.conference_game) && t("game.conference")}
      </p>

      {tw && tw.length === 2 && (
        <>
          <h2>{t("game.teamStats")}</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th></th>
                  {sides.map((t) => <th key={t}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {TEAM_ROWS.map((c) => (
                  <tr key={c}>
                    <td>{c === "possession_sec"
                      ? t("ncaa.possession") : label(c)}</td>
                    {sides.map((t) => (
                      <td key={t} className="num">{fmtVal(c, twOf(t)?.[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pw && sides.map((tm) => {
        const rows = pw.filter((r) => r.team === tm);
        if (rows.length === 0) return null;
        return (
          <div key={tm}>
            <h2>
              <NcaaLogo src={tmap.get(tm)?.logo} size={22} />
              {" "}{t("ncaa.boxScore", { team: tmap.get(tm)?.school ?? tm })}
            </h2>
            <BoxTable rows={rows} title={t("ncaa.passing")}
              cols={["completions", "attempts", "passing_yards", "passing_tds",
                     "passing_interceptions", "qbr"]}
              filter={(r) => Number(r.attempts ?? 0) > 0} />
            <BoxTable rows={rows} title={t("ncaa.rushing")}
              cols={["carries", "rushing_yards", "rushing_tds", "rush_long"]}
              filter={(r) => Number(r.carries ?? 0) > 0} />
            <BoxTable rows={rows} title={t("ncaa.receiving")}
              cols={["receptions", "receiving_yards", "receiving_tds", "rec_long"]}
              filter={(r) => Number(r.receptions ?? 0) > 0} />
          </div>
        );
      })}
    </section>
  );
}
