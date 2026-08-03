import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import {
  loadNgs, loadPlayerIndex, loadPlayerScheme, loadPlayerSeason,
  loadPlayerWeeks, loadProjections, loadProjEval, loadRedzone,
  loadSnapCounts,
} from "../lib/data";
import { projLine, PRIMARY_STAT } from "../lib/projText";
import ProjRanges from "../components/ProjRanges";
import TeamLogo from "../components/TeamLogo";
import Trend from "../components/Trend";
import { fmt as fmtStat, label, pct, presetForPosition } from "../lib/columns";
import { trendOf, WeeklyBarChart } from "../components/charts";
import StatusBadge from "../components/StatusBadge";
import { loadInjuries } from "../lib/data";
import StatTiles from "../components/StatTiles";
import { downloadStatCard } from "../lib/statcard";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { teamName } from "../lib/teams";
import { useT } from "../lib/i18n";

const RZ_COLS: Record<string, string[]> = {
  QB: ["rz_pass_att", "rz_pass_tds", "rz_pass_ints", "rz_carries", "rz_rush_tds",
       "i10_pass_att", "i10_pass_tds", "i10_carries", "i10_rush_tds"],
  RB: ["rz_carries", "rz_rush_tds", "rz_targets", "rz_receptions", "rz_rec_tds",
       "i10_carries", "i10_rush_tds", "i10_targets", "i10_rec_tds"],
  REC: ["rz_targets", "rz_receptions", "rz_rec_tds", "rz_carries", "rz_rush_tds",
        "i10_targets", "i10_receptions", "i10_rec_tds"],
};

const NGS_TYPE: Record<string, "passing" | "rushing" | "receiving"> = {
  QB: "passing", RB: "rushing", FB: "rushing", WR: "receiving", TE: "receiving",
};

const NGS_VIEW_COLS: Record<string, string[]> = {
  passing: ["attempts", "pass_yards", "pass_touchdowns", "interceptions",
            "passer_rating", "completion_percentage", "expected_completion_percentage",
            "completion_percentage_above_expectation", "avg_time_to_throw",
            "avg_intended_air_yards", "aggressiveness"],
  rushing: ["rush_attempts", "rush_yards", "rush_touchdowns", "efficiency",
            "percent_attempts_gte_eight_defenders", "avg_time_to_los",
            "expected_rush_yards", "rush_yards_over_expected",
            "rush_yards_over_expected_per_att"],
  receiving: ["targets", "receptions", "yards", "rec_touchdowns", "catch_percentage",
              "avg_separation", "avg_cushion", "avg_intended_air_yards",
              "percent_share_of_intended_air_yards", "avg_yac",
              "avg_yac_above_expectation"],
};

export default function PlayerDetail({ seasons }: { seasons: number[] }) {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [season, setSeason] = useState(seasons[0]);

  const { data: index } = useAsync(() => loadPlayerIndex(), []);
  const player = useMemo(
    () => index?.find((p) => p.player_id === id) ?? null,
    [index, id],
  );

  // Kariyer: her sezonun toplam satırı
  const { data: career, error: careerErr } = useAsync(async () => {
    const per = await Promise.all(
      seasons.map(async (s): Promise<StatRow | null> => {
        try {
          const rows = await loadPlayerSeason(s);
          const row = rows.find((r) => r.player_id === id);
          return row ? { ...row, season: s } : null;
        } catch { return null; }
      }),
    );
    return per
      .filter((r): r is StatRow => r !== null)
      .sort((a, b) => Number(b.season) - Number(a.season));
  }, [id, seasons.join()]);

  const { data: weeks, error: weeksErr, loading } = useAsync(async () => {
    const rows = await loadPlayerWeeks(season);
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, season]);

  const pos = String(player?.position ?? weeks?.[0]?.position ?? "");
  const stats = presetForPosition(pos || null);
  const [statChoice, setStatChoice] = useState<string | null>(null);
  const chartStat = statChoice ?? stats[0];
  const setChartStat = (s: string) => { setStatChoice(s); setThrChoice(null); };

  // Sürüklenebilir eşik: varsayılan sezon ortalaması; stat/sezon değişince sıfırlanır
  const [thrChoice, setThrChoice] = useState<number | null>(null);
  const regWeeks = useMemo(
    () => (weeks ?? []).filter((r) => r.season_type === "REG"), [weeks]);
  const threshold = useMemo(() => {
    if (thrChoice !== null) return thrChoice;
    if (regWeeks.length === 0) return null;
    const vals = regWeeks.map((r) => Number(r[chartStat] ?? 0));
    return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
  }, [thrChoice, regWeeks, chartStat]);
  const overCount = useMemo(() => {
    if (threshold === null) return null;
    const over = regWeeks.filter(
      (r) => Number(r[chartStat] ?? 0) >= threshold).length;
    return { over, total: regWeeks.length,
             pct: regWeeks.length ? Math.round(100 * over / regWeeks.length) : 0 };
  }, [threshold, regWeeks, chartStat]);

  // Red zone (seçili sezon)
  const { data: rz } = useAsync(async () => {
    const rows = await loadRedzone(season);
    return rows?.find((r) => r.player_id === id) ?? null;
  }, [id, season]);
  const rzCols = RZ_COLS[pos] ?? RZ_COLS.REC;

  // Snap counts (seçili sezon, haftalık)
  const { data: snaps } = useAsync(async () => {
    const rows = await loadSnapCounts(season);
    if (!rows) return null;
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((r) => ({ ...r, season_type: r.game_type === "REG" ? "REG" : "POST" }));
  }, [id, season]);
  const snapStat = ["QB", "RB", "FB", "WR", "TE", "K", "P", "T", "G", "C"]
    .includes(pos) ? "offense_pct" : "defense_pct";

  // Bu haftanın projeksiyonu + geçmiş tahmin-vs-gerçek karnesi
  const { data: projections } = useAsync(() => loadProjections(), []);
  const myProj = useMemo(
    () => projections?.rows.find((p) => p.player_id === id) ?? null,
    [projections, id]);
  const { data: projEval } = useAsync(() => loadProjEval(), []);
  const projHistory = useMemo(() => {
    if (!projEval) return [];
    return projEval.players
      .filter((p) => p.player_id === id)
      .sort((a, b) => Number(b.week) - Number(a.week));
  }, [projEval, id]);
  const histAccuracy = useMemo(() => {
    if (projHistory.length === 0) return null;
    const prim = PRIMARY_STAT[String(projHistory[0].position)] ?? "receiving_yards";
    const diffs = projHistory
      .filter((p) => p[`proj_${prim}`] !== null && p[`act_${prim}`] !== null)
      .map((p) => ({
        abs: Math.abs(Number(p[`proj_${prim}`]) - Number(p[`act_${prim}`])),
        act: Number(p[`act_${prim}`]),
      }));
    if (diffs.length === 0) return null;
    const mae = diffs.reduce((s, d) => s + d.abs, 0) / diffs.length;
    const close = diffs.filter((d) => d.abs <= Math.max(15, d.act * 0.25)).length;
    return { prim, mae: mae.toFixed(1), n: diffs.length,
             closePct: Math.round(100 * close / diffs.length) };
  }, [projHistory]);

  // Sakatlık geçmişi (en güncel rapor sezonu)
  const { data: injuries } = useAsync(async () => {
    const rows = await loadInjuries();
    if (!rows) return null;
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(b.week ?? 0) - Number(a.week ?? 0));
  }, [id]);
  const latestInjury = injuries?.[0] ?? null;

  // Hücum şeması splitleri (seçili sezon)
  const { data: scheme } = useAsync(async () => {
    const rows = await loadPlayerScheme(season);
    if (!rows) return null;
    return rows.filter((r) => r.player_id === id);
  }, [id, season]);

  // Next Gen Stats (seçili sezon, pozisyona göre tip)
  const ngsType = NGS_TYPE[pos];
  const { data: ngs } = useAsync(async () => {
    if (!ngsType) return null;
    const rows = await loadNgs(season, ngsType);
    if (!rows) return null;
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, season, ngsType]);

  return (
    <section>
      <div className="player-header">
        {player?.headshot_url && (
          <img className="headshot" src={String(player.headshot_url)} alt=""
               onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div>
          <h1>{String(player?.player_name ?? id)}</h1>
          <p className="sub">
            {pos || "?"} · {teamName(player?.team as string | null)}
            {player && ` · ${player.first_season}–${player.last_season}`}
            {" "}
            <StatusBadge status={latestInjury?.report_status as string}
                         note={latestInjury?.report_primary_injury as string} />
          </p>
        </div>
      </div>

      {myProj && projections && (
        <div className="proj-now">
          <div className="proj-now-head">
            <strong>{t("player.projThisWeek")}</strong>
            <span className="proj-now-sub">
              {projections.target.season} · {t("common.week")} {projections.target.week}
              {" · "}
              {t("player.projEngine", { engine: t(projections.engine === "ml"
                  ? "player.engineMl" : "player.engineHeuristic") })}
            </span>
          </div>
          <div className="proj-now-body">
            <span className="proj-now-opp">
              <TeamLogo abbr={String(myProj.opponent ?? "")} size={24} />
              {" vs "}{teamName(myProj.opponent as string | null)}
            </span>
            <StatusBadge status={myProj.injury_status as string}
                         note={myProj.injury_note as string} />
          </div>
          {/* her stat kendi taban–tavan aralığıyla */}
          <ProjRanges row={myProj} />
          <p className="proj-now-note">{t("proj.rangeNote")}</p>
        </div>
      )}

      <h2>{t("player.career")}</h2>
      {careerErr && <ErrorMsg msg={careerErr} />}
      {career && (
        <StatTable rows={career} columns={["season", "team", "games", ...stats]}
                   defaultSort="season" />
      )}

      <h2>{t("player.gamelog")}</h2>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <button className="pill"
                onClick={() => {
                  const row = career?.find((r) => Number(r.season) === season);
                  if (row)
                    downloadStatCard(String(row.player_name ?? id), pos,
                                     String(row.team ?? ""), season, row,
                                     ["games", ...stats]);
                }}>
          {t("player.statCard")}
        </button>
      </div>
      {loading && <Loading />}
      {weeksErr && <ErrorMsg msg={weeksErr} />}
      {weeks && weeks.length > 0 && (
        <>
          <div className="toolbar">
            <div className="pill-row">
              {stats.map((s) => (
                <button key={s} className={`pill small ${s === chartStat ? "active" : ""}`}
                        onClick={() => setChartStat(s)}>
                  {label(s)}
                </button>
              ))}
            </div>
            {(() => {
              const tr = trendOf(weeks, chartStat);
              const txt = t(tr.kind === "hot" ? "common.trendHot"
                : tr.kind === "cold" ? "common.trendCold" : "common.trendFlat");
              return (
                <span className={`trend-chip ${tr.kind}`}
                      title={t("common.trendTitle", { recent: tr.recent.toFixed(1),
                                                      season: tr.season.toFixed(1) })}>
                  <Trend kind={tr.kind === "hot" ? "up"
                    : tr.kind === "cold" ? "down" : "flat"} />
                  {txt} · {t("common.trendDetail", { recent: tr.recent.toFixed(1),
                                                    season: tr.season.toFixed(1) })}
                </span>
              );
            })()}
          </div>
          {threshold !== null && overCount && (
            <div className="toolbar" style={{ marginBottom: 4 }}>
              <span className="thr-chip">
                {t("player.threshold", {
                  value: fmtStat(chartStat, threshold), over: overCount.over,
                  total: overCount.total, pct: pct(overCount.pct) })}
              </span>
              <input className="axis-select small" type="number" step="0.5"
                     style={{ width: 90 }}
                     value={threshold}
                     onChange={(e) => setThrChoice(Number(e.target.value))} />
            </div>
          )}
          <WeeklyBarChart rows={weeks} stat={chartStat}
                          threshold={threshold}
                          onThresholdChange={(v) =>
                            setThrChoice(Number(v.toFixed(1)))} />
        </>
      )}
      {weeks && (
        <StatTable rows={weeks}
          columns={["week", "season_type", "opponent_team", ...stats]}
          defaultSort="week"
          render={{
            opponent_team: (row) => (
              <Link to={`/team/${row.opponent_team}`}>
                {String(row.opponent_team ?? "—")}
              </Link>
            ),
          }}
        />
      )}

      {projHistory.length > 0 && (
        <>
          <h2>{t("player.reportCard")}</h2>
          <p className="sub">
            {t("player.reportCardSub")}
            {histAccuracy && (
              <>
                {" "}{t("player.maeSummary", {
                  stat: label(histAccuracy.prim), mae: histAccuracy.mae,
                  n: histAccuracy.n, pct: pct(histAccuracy.closePct) })}
              </>
            )}
          </p>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>{t("common.week")}</th><th>{t("common.opponent")}</th>
                  <th>{t("common.projected")}</th><th>{t("common.actualStat")}</th>
                  <th>Δ ({label(histAccuracy?.prim ?? "")})</th>
                </tr>
              </thead>
              <tbody>
                {projHistory.map((p) => {
                  const prim = PRIMARY_STAT[String(p.position)] ?? "receiving_yards";
                  const pv = p[`proj_${prim}`], av = p[`act_${prim}`];
                  const played = pv !== null && pv !== undefined
                    && av !== null && av !== undefined;
                  const diff = played ? Number(av) - Number(pv) : null;
                  const close = diff !== null
                    && Math.abs(diff) <= Math.max(15, Number(av) * 0.25);
                  return (
                    <tr key={String(p.week)}>
                      <td>W{String(p.week)}</td>
                      <td>{String(p.opponent ?? "—")}</td>
                      <td>{projLine(p, "proj")}</td>
                      <td>{played ? projLine(p, "act") : t("player.dnp")}</td>
                      <td className={diff === null ? "" : close ? "delta-good" : "delta-bad"}>
                        {diff === null ? "—"
                          : `${diff > 0 ? "+" : ""}${diff.toFixed(0)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rz && (
        <>
          <h2>{t("player.redzone", { season })}</h2>
          <StatTiles row={rz} cols={rzCols} />
        </>
      )}

      {scheme && scheme.length > 0 && (
        <>
          <h2>{t("player.schemeSplits", { season })}</h2>
          <p className="sub">
            {t("player.schemeSplitsSub")}
          </p>
          <StatTable
            rows={scheme.map((r) => ({
              ...r,
              split: `${String(r.unit)} · ${label(`split_${r.split}`)}`,
            }))}
            columns={["split", "plays", "yards", "tds", "ints",
                      "epa_play", "success_rate"]}
            defaultSort="plays" />
        </>
      )}

      {ngs && ngs.length > 0 && (
        <>
          <h2>{t("player.ngs", { season })}</h2>
          <p className="sub">{t("player.ngsSub")}</p>
          <StatTable rows={ngs}
            columns={["week", ...NGS_VIEW_COLS[ngsType!]]}
            defaultSort="week" />
        </>
      )}

      {injuries && injuries.length > 0 && (
        <>
          <h2>{t("player.injuryHistory", { season: String(injuries[0].season) })}</h2>
          <StatTable rows={injuries}
            columns={["week", "team", "report_status", "report_primary_injury",
                      "practice_status", "date_modified"]}
            defaultSort="week" />
        </>
      )}

      {snaps && snaps.length > 0 && (
        <>
          <h2>{t("player.snapCounts", { season })}</h2>
          <WeeklyBarChart rows={snaps} stat={snapStat} />
          <StatTable rows={snaps}
            columns={["week", "game_type", "opponent", "offense_snaps",
                      "offense_pct", "defense_snaps", "defense_pct",
                      "st_snaps", "st_pct"]}
            defaultSort="week" />
        </>
      )}
    </section>
  );
}
