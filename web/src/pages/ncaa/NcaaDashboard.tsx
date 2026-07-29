import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import PName, { PosTag } from "../../components/PName";
import { ErrorMsg, Loading } from "../../components/Pickers";
import { label } from "../../lib/columns";
import { loadNcaaNextSchedule, loadNcaaPlayerSeason, loadNcaaPlayerWeeks,
         loadNcaaSchedule, loadNcaaTeams, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { kickoffBerlin } from "../../lib/time";
import type { StatRow } from "../../lib/types";
import { translate, useT } from "../../lib/i18n";

const BOARDS = ["passing_yards", "rushing_yards", "receiving_yards",
                "passing_tds", "rushing_tds", "receiving_tds"];

const ord = (r: StatRow) =>
  Number(r.week) + (String(r.season_type) === "POST" ? 100 : 0);

function statLine(p: StatRow): string {
  const parts: string[] = [];
  if (Number(p.passing_yards ?? 0) > 0)
    parts.push(`${p.completions}/${p.attempts}, ${p.passing_yards} ${translate("u.passYd")}, ${p.passing_tds ?? 0} TD`);
  if (Number(p.rushing_yards ?? 0) > 30 || Number(p.carries ?? 0) >= 8)
    parts.push(`${p.carries} ${translate("u.car")} ${p.rushing_yards} ${translate("u.yd")}, ${p.rushing_tds ?? 0} TD`);
  if (Number(p.receiving_yards ?? 0) > 30)
    parts.push(`${p.receptions} rec ${p.receiving_yards} ${translate("u.yd")}, ${p.receiving_tds ?? 0} TD`);
  return parts.join(" · ") || "—";
}

export default function NcaaDashboard({ seasons }: { seasons: number[] }) {
  const t = useT();
  const season = seasons[0];
  const { data, error, loading } = useAsync(
    () => loadNcaaPlayerSeason(season), [season]);
  const { data: pw } = useAsync(() => loadNcaaPlayerWeeks(season), [season]);
  const { data: sched } = useAsync(() => loadNcaaSchedule(season), [season]);
  const { data: nextSched } = useAsync(() => loadNcaaNextSchedule(), []);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);
  const [open, setOpen] = useState<string | null>(null);

  // Son oynanan hafta (POST > REG)
  const lastOrd = useMemo(() => {
    const played = (sched ?? []).filter((g) => g.home_score !== null);
    return played.length ? Math.max(...played.map(ord)) : null;
  }, [sched]);
  const lastLabel = lastOrd === null ? ""
    : lastOrd > 100 ? translate("ncaa.bowl")
    : translate("ncaa.weekLabel", { n: lastOrd });

  const topPerfs = useMemo(() => {
    if (!pw || lastOrd === null) return [];
    return pw.filter((r) => ord(r) === lastOrd)
      .map((r): StatRow & { _best: number } => ({
        ...r,
        _best: Math.max(Number(r.passing_yards ?? 0),
                        Number(r.rushing_yards ?? 0),
                        Number(r.receiving_yards ?? 0)),
      }))
      .sort((a, b) => b._best - a._best)
      .slice(0, 8);
  }, [pw, lastOrd]);

  const lastScores = useMemo(() => {
    if (!sched || lastOrd === null) return [];
    return sched.filter((g) => g.home_score !== null && ord(g) === lastOrd)
      .sort((a, b) =>
        Number(b.home_score) + Number(b.away_score)
        - Number(a.home_score) - Number(a.away_score))
      .slice(0, 12);
  }, [sched, lastOrd]);

  const upcoming = useMemo(() => {
    if (!nextSched) return [];
    const open_ = nextSched.filter((g) => g.home_score === null);
    if (open_.length === 0) return [];
    const minOrd = Math.min(...open_.map(ord));
    return open_.filter((g) => ord(g) === minOrd)
      .sort((a, b) => String(a.gameday).localeCompare(String(b.gameday)))
      .slice(0, 10);
  }, [nextSched]);
  const nextSeason = upcoming.length ? Number(upcoming[0].season) : null;

  const boards = useMemo(() => BOARDS.map((stat) => ({
    stat,
    rows: (data ?? [])
      .filter((p) => p[stat] !== null && Number(p[stat]) > 0)
      .sort((a, b) => Number(b[stat]) - Number(a[stat]))
      .slice(0, 30),
  })), [data]);

  return (
    <section>
      <div className="dash-head">
        <h1>{t("ncaa.dashTitle", { season })}</h1>
        <p className="sub">
          {t("ncaa.dashSub")}
          {lastOrd !== null && <>{t("ncaa.lastPlayed")}<strong>{lastLabel}</strong>.</>}
          {nextSeason && <>{t("ncaa.newFixture")}
            <Link to="/ncaa/games">{nextSeason} W{upcoming[0]?.week ?? 1}</Link>.</>}
        </p>
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}

      {topPerfs.length > 0 && (
        <>
          <h2>{t("ncaa.topPerf", { label: lastLabel })}</h2>
          <div className="perf-strip">
            {topPerfs.map((p) => (
              <div className="perf-card" key={String(p.player_id)}>
                {p.headshot && (
                  <img className="perf-headshot" src={String(p.headshot)} alt=""
                       onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
                <div className="perf-body">
                  <span className="perf-name">
                    <Link to={`/ncaa/player/${p.player_id}`}>
                      {String(p.player_name)}
                    </Link>
                    <PosTag pos={String(p.position ?? "")} />
                  </span>
                  <span className="perf-team">
                    {String(p.team)} vs {String(p.opponent)}
                  </span>
                  <span className="perf-stat">{statLine(p)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="dash-cols">
        <div className="dash-scores">
          <h2>{t("ncaa.scores", { label: lastLabel })}</h2>
          {lastScores.map((g) => (
            <Link className="score-line" key={String(g.game_id)}
                  to={`/ncaa/game/${season}/${g.game_id}`}>
              <span className="team-cell">
                <NcaaLogo src={tmap.get(String(g.away_team))?.logo} size={18} />
                {String(g.away_team)} {String(g.away_score)}
              </span>
              <span>—</span>
              <span className="team-cell">
                <strong>{String(g.home_score)} {String(g.home_team)}</strong>
                <NcaaLogo src={tmap.get(String(g.home_team))?.logo} size={18} />
              </span>
            </Link>
          ))}
          <Link className="drawer-link" to="/ncaa/games">{t("ncaa.allGames")}</Link>
        </div>
        <div className="dash-feed">
          {upcoming.length > 0 && (
            <>
              <h2>{t("ncaa.openers", { season: nextSeason ?? "" })}</h2>
              {upcoming.map((g) => (
                <div className="feed-item" key={String(g.game_id)}>
                  <span className="feed-title">
                    <NcaaLogo src={tmap.get(String(g.away_team))?.logo} size={16} />
                    {" "}{tmap.get(String(g.away_team))?.school ?? String(g.away_team)}
                    {" @ "}
                    <NcaaLogo src={tmap.get(String(g.home_team))?.logo} size={16} />
                    {" "}{tmap.get(String(g.home_team))?.school ?? String(g.home_team)}
                  </span>
                  <span className="feed-detail">
                    {kickoffBerlin(g.kickoff as string, true) ?? String(g.gameday)}
                    {kickoffBerlin(g.kickoff as string) && " (DE)"}
                    {Boolean(g.neutral_site) && t("game.neutral")}
                  </span>
                </div>
              ))}
              <Link className="drawer-link" to="/ncaa/projections">
                {t("ncaa.week1Proj")}
              </Link>
            </>
          )}
        </div>
      </div>

      <h2>{t("ncaa.leaders", { season })}</h2>
      <div className="standings-grid">
        {boards.map(({ stat, rows }) => (
          <div className="standings-card" key={stat}>
            <h3>{label(stat)}</h3>
            <table className="stat-table">
              <tbody>
                {rows.slice(0, open === stat ? 30 : 10).map((p, i) => (
                  <tr key={String(p.player_id)}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <PName name={String(p.player_name)}
                             pos={String(p.position ?? "")}
                             id={String(p.player_id)} base="/ncaa/player" />
                    </td>
                    <td>
                      <Link to={`/ncaa/team/${p.team}`}>{String(p.team)}</Link>
                    </td>
                    <td className="num"><strong>{String(p[stat])}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="pill small"
                    onClick={() => setOpen(open === stat ? null : stat)}>
              {t(open === stat ? "common.collapse" : "common.showTop30Plain")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
