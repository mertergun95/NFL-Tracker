import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PName from "../components/PName";
import TeamLogo from "../components/TeamLogo";
import Trend from "../components/Trend";
import NextSlate from "../components/NextSlate";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import {
  loadInsights, loadPlayerSeason, loadPlayerWeeks, loadSchedule,
} from "../lib/data";
import { useAsync } from "../lib/hooks";
import { fmt } from "../lib/columns";
import type { Manifest, StatRow } from "../lib/types";
import { localized, translate, useI18n } from "../lib/i18n";

const LEADER_BOARDS: { title: string; col: string; pos?: string[] }[] = [
  { title: "dash.passYards", col: "passing_yards", pos: ["QB"] },
  { title: "dash.rushYards", col: "rushing_yards" },
  { title: "dash.recYards", col: "receiving_yards" },
  { title: "Pas TD", col: "passing_tds", pos: ["QB"] },
  { title: "dash.totalTd", col: "_total_td" },
  { title: "Sack (savunma)", col: "def_sacks" },
];

function statLine(r: StatRow): string {
  const pos = String(r.position);
  if (pos === "QB")
    return `${r.completions}/${r.attempts} · ${r.passing_yards} pas yd · ${r.passing_tds} TD`;
  if (pos === "RB")
    return `${r.carries} ${translate("u.car")} · ${r.rushing_yards} ${translate("u.yd")} · ${Number(r.rushing_tds ?? 0) + Number(r.receiving_tds ?? 0)} TD`;
  return `${r.receptions}/${r.targets} · ${r.receiving_yards} yd · ${r.receiving_tds} TD`;
}

function leaders(rows: StatRow[], col: string, pos: string[] | undefined,
                 count: number): StatRow[] {
  let r = rows;
  if (pos) r = r.filter((p) => pos.includes(String(p.position)));
  const val = (p: StatRow) =>
    col === "_total_td"
      ? Number(p.rushing_tds ?? 0) + Number(p.receiving_tds ?? 0)
      : Number(p[col] ?? 0);
  return [...r].sort((a, b) => val(b) - val(a)).slice(0, count)
    .map((p) => ({ ...p, _value: val(p) }));
}

function LeaderCard({ title, col, pos, data }:
  { title: string; col: string; pos?: string[]; data: StatRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const items = leaders(data, col, pos, expanded ? 30 : 5);
  return (
    <div className={`leader-card ${expanded ? "expanded" : ""}`}>
      <h3>{translate(title)}</h3>
      <ol>
        {items.map((p) => (
          <li key={String(p.player_id)}>
            <PName name={String(p.player_name)} pos={String(p.position ?? "")}
                   id={String(p.player_id)} />
            <span className="leader-team">{String(p.team ?? "")}</span>
            <strong>{fmt(col, p._value as number)}</strong>
          </li>
        ))}
      </ol>
      <button className="leader-toggle" onClick={() => setExpanded(!expanded)}>
        {translate(expanded ? "common.expand" : "common.showTop30")}
      </button>
    </div>
  );
}

export default function Dashboard({ manifest, seasons }:
  { manifest: Manifest; seasons: number[] }) {
  const { t, lang } = useI18n();
  const [season, setSeason] = useState(seasons[0]);
  const info = manifest.seasons[String(season)];
  const lastWeek = info?.last_reg_week ?? 0;

  const { data: seasonRows, error, loading } =
    useAsync(() => loadPlayerSeason(season), [season]);
  const { data: weekRows } = useAsync(() => loadPlayerWeeks(season), [season]);
  const { data: sched } = useAsync(() => loadSchedule(season), [season]);
  const { data: insights } = useAsync(() => loadInsights(), []);

  // Son haftanın yıldız performansları
  const topPerformances = useMemo(() => {
    if (!weekRows || !lastWeek) return [];
    return weekRows
      .filter((r) => Number(r.week) === lastWeek && r.season_type === "REG"
                     && ["QB", "RB", "WR", "TE"].includes(String(r.position)))
      .sort((a, b) => Number(b.fantasy_points_ppr ?? 0)
                      - Number(a.fantasy_points_ppr ?? 0))
      .slice(0, 8);
  }, [weekRows, lastWeek]);

  // Son haftanın skorları
  const lastScores = useMemo(() => {
    if (!sched) return [];
    return sched
      .filter((g) => Number(g.week) === lastWeek && g.game_type === "REG"
                     && g.home_score !== null)
      .sort((a, b) => (Number(b.home_score) + Number(b.away_score))
                      - (Number(a.home_score) + Number(a.away_score)));
  }, [sched, lastWeek]);

  // Değişim akışı: insights'tan form + kullanım maddeleri karışık
  const feed = useMemo(() => {
    if (!insights) return [];
    const s = insights.sections;
    const mixed = [
      ...(s.hot ?? []).slice(0, 4),
      ...(s.usage ?? []).slice(0, 3),
      ...(s.cold ?? []).slice(0, 3),
    ];
    return mixed;
  }, [insights]);

  return (
    <section>
      <div className="dash-head">
        <div>
          <h1>{t("nfl.dashTitle", { season })}</h1>
          <p className="sub">
            {t("dash.sub", { n: seasons.length, season, week: lastWeek,
                             date: manifest.generated_at.slice(0, 10) })}
          </p>
        </div>
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}

      <NextSlate />

      <h2>{t("dash.stars", { week: lastWeek })}</h2>
      <div className="perf-strip">
        {topPerformances.map((r) => (
          <Link to={`/player/${r.player_id}`} className="perf-card"
                key={String(r.player_id)}>
            {r.headshot_url && (
              <img className="perf-headshot" src={String(r.headshot_url)} alt=""
                   loading="lazy"
                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <div className="perf-body">
              <div className="perf-name">
                {String(r.player_name)}
                <sub className="pos-tag">{String(r.position)}</sub>
              </div>
              <div className="perf-team">
                <TeamLogo abbr={String(r.team)} size={16} /> {String(r.team)}
                {" vs "}{String(r.opponent_team)}
              </div>
              <div className="perf-stat">{statLine(r)}</div>
            </div>
            <div className="perf-ppr">
              {fmt("fantasy_points_ppr", r.fantasy_points_ppr)}
              <span>PPR</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="dash-cols">
        <div>
          <h2>{t("dash.scores", { week: lastWeek })}</h2>
          <div className="dash-scores">
            {lastScores.map((g) => (
              <Link to={`/game/${season}/${g.game_id}`} className="score-line"
                    key={String(g.game_id)}>
                <span className="team-cell">
                  <TeamLogo abbr={String(g.away_team)} size={18} />
                  {String(g.away_team)}
                </span>
                <strong>{String(g.away_score)}–{String(g.home_score)}</strong>
                <span className="team-cell" style={{ justifyContent: "flex-end" }}>
                  {String(g.home_team)}
                  <TeamLogo abbr={String(g.home_team)} size={18} />
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2>{t("dash.changes")}</h2>
          <div className="dash-feed">
            {feed.map((it, i) => (
              <div className="feed-item" key={i}>
                <div className="feed-title">
                  <Trend kind={it.kind} />
                  {it.player_id
                    ? <Link to={`/player/${it.player_id}`}>
                        {localized(it.title, lang)}
                      </Link>
                    : localized(it.title, lang)}
                </div>
                <div className="feed-detail">{localized(it.detail, lang)}</div>
              </div>
            ))}
            <Link className="drawer-link" to="/insights">{t("dash.allInsights")}</Link>
          </div>
        </div>
      </div>

      <h2>{t("dash.leaders")}</h2>
      {seasonRows && (
        <div className="leader-grid">
          {LEADER_BOARDS.map(({ title, col, pos }) => (
            <LeaderCard key={title} title={title} col={col} pos={pos}
                        data={seasonRows} />
          ))}
        </div>
      )}
    </section>
  );
}
