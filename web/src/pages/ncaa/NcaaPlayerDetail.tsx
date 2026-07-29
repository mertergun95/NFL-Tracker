import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { trendOf, WeeklyBarChart } from "../../components/charts";
import { fmt as fmtStat, label, pct } from "../../lib/columns";
import { loadNcaaPlayerIndex, loadNcaaPlayerSeason, loadNcaaPlayerWeeks,
         loadNcaaProjections, loadNcaaProjEval, NCAA_PRIMARY, ncaaPreset,
         ncaaProjLine } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import type { StatRow } from "../../lib/types";
import { useT } from "../../lib/i18n";

export default function NcaaPlayerDetail({ seasons }: { seasons: number[] }) {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [seasonChoice, setSeasonChoice] = useState<number | null>(null);

  const { data: index } = useAsync(() => loadNcaaPlayerIndex(), []);
  const player = useMemo(
    () => index?.find((p) => p.player_id === id) ?? null, [index, id]);
  // Varsayılan: oyuncunun oynadığı son sezon (mezunlarda boş log açılmasın)
  const season = seasonChoice ?? Number(player?.last_season ?? seasons[0]);
  const setSeason = setSeasonChoice;

  const { data: career, error: careerErr } = useAsync(async () => {
    const per = await Promise.all(
      seasons.map(async (s): Promise<StatRow | null> => {
        try {
          const rows = await loadNcaaPlayerSeason(s);
          const row = rows.find((r) => r.player_id === id);
          return row ? { ...row, season: s } : null;
        } catch { return null; }
      }),
    );
    return per.filter((r): r is StatRow => r !== null)
      .sort((a, b) => Number(b.season) - Number(a.season));
  }, [id, seasons.join()]);

  const { data: weeks, error: weeksErr, loading } = useAsync(async () => {
    const rows = await loadNcaaPlayerWeeks(season);
    return rows.filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, season]);

  // Yaklaşan haftanın projeksiyonu (güncel kadroya göre)
  const { data: projections } = useAsync(() => loadNcaaProjections(), []);
  const myProj = useMemo(
    () => projections?.rows.find((p) => p.player_id === id) ?? null,
    [projections, id]);

  // Geçmiş tahmin-vs-gerçek karnesi
  const { data: projEval } = useAsync(() => loadNcaaProjEval(), []);
  const projHistory = useMemo(() => {
    if (!projEval) return [];
    return projEval.players
      .filter((p) => p.player_id === id)
      .sort((a, b) => Number(b.week) - Number(a.week));
  }, [projEval, id]);
  const histAccuracy = useMemo(() => {
    if (projHistory.length === 0) return null;
    const prim = NCAA_PRIMARY[String(projHistory[0].position)] ?? "receiving_yards";
    const diffs = projHistory
      .filter((p) => p[`proj_${prim}`] != null && p[`act_${prim}`] != null)
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

  const pos = String(player?.position ?? weeks?.[0]?.position ?? "WR");
  const stats = ncaaPreset(pos);
  const [statChoice, setStatChoice] = useState<string | null>(null);
  const chartStat = statChoice ?? stats[stats.includes("passing_yards") ? 2 : 1];

  // Sürüklenebilir eşik (NFL oyuncu sayfasıyla aynı davranış)
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

  return (
    <section>
      <div className="player-header">
        {player?.headshot && (
          <img className="headshot" src={String(player.headshot)} alt=""
               onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div>
          <h1>{String(player?.player_name ?? weeks?.[0]?.player_name ?? id)}</h1>
          <p className="sub">
            {pos} · <Link to={`/ncaa/team/${player?.team ?? weeks?.[0]?.team}`}>
              {String(player?.team ?? weeks?.[0]?.team ?? "?")}
            </Link>
            {player && ` · ${player.first_season}–${player.last_season}`}
            {player?.current_team && player.current_team !== player.team &&
              <> · {t("player.currentlyOn")}<Link to={`/ncaa/team/${player.current_team}`}>
                {String(player.current_team)}</Link></>}
            {" · NCAA FBS"}
          </p>
        </div>
      </div>

      {myProj && projections && (
        <div className="proj-now">
          <div className="proj-now-head">
            <strong>{t("ncaa.projUpcoming")}</strong>
            <span className="proj-now-sub">
              {projections.target.season} · {t("common.week")} {projections.target.week}
              {" · "}{t("player.projEngine", { engine: t("player.engineHeuristic") })}
              {" · "}{t("common.team")}: {String(myProj.team)}
            </span>
          </div>
          <div className="proj-now-body">
            <span className="proj-now-opp">
              {myProj.is_home ? "vs" : "@"}{" "}
              <Link to={`/ncaa/team/${myProj.opponent}`}>
                {String(myProj.opponent)}
              </Link>
            </span>
            <span className="proj-now-line">
              {String(myProj.position) === "QB"
                ? `${myProj.proj_completions}/${myProj.proj_attempts} · ${myProj.proj_passing_yards} ${t("u.passYd")} · ${myProj.proj_passing_tds} TD · ${myProj.proj_rushing_yards} ${t("u.rushYd")}`
                : String(myProj.position) === "RB"
                ? `${myProj.proj_carries} ${t("u.car")} · ${myProj.proj_rushing_yards} ${t("u.yd")} · ${myProj.proj_receptions} rec · ${myProj.proj_receiving_yards} ${t("u.recYd")}`
                : `${myProj.proj_receptions} rec · ${myProj.proj_receiving_yards} ${t("u.yd")} · ${myProj.proj_receiving_tds} TD`}
            </span>
          </div>
        </div>
      )}

      <h2>{t("player.career")}</h2>
      {careerErr && <ErrorMsg msg={careerErr} />}
      {career && (
        <StatTable rows={career} columns={["season", "team", "games", ...stats]}
                   defaultSort="season" />
      )}

      <h2>{t("player.gamelog")}</h2>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {weeksErr && <ErrorMsg msg={weeksErr} />}
      {weeks && weeks.length > 0 && (
        <>
          <div className="toolbar">
            <div className="pill-row">
              {stats.map((s) => (
                <button key={s}
                        className={`pill small ${s === chartStat ? "active" : ""}`}
                        onClick={() => { setStatChoice(s); setThrChoice(null); }}>
                  {label(s)}
                </button>
              ))}
            </div>
            {(() => {
              const tr = trendOf(weeks, chartStat);
              const txt = t(tr.kind === "hot" ? "common.trendHot"
                : tr.kind === "cold" ? "common.trendCold" : "common.trendFlat");
              return (
                <span className={`trend-chip ${tr.kind}`}>
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
                     style={{ width: 90 }} value={threshold}
                     onChange={(e) => setThrChoice(Number(e.target.value))} />
            </div>
          )}
          <WeeklyBarChart rows={weeks} stat={chartStat} threshold={threshold}
                          onThresholdChange={(v) =>
                            setThrChoice(Number(v.toFixed(1)))} />
          <StatTable rows={weeks}
            columns={["week", "season_type", "opponent", ...stats]}
            defaultSort="week"
            render={{
              opponent: (row) => (
                <Link to={`/ncaa/team/${row.opponent}`}>
                  {String(row.opponent ?? "—")}
                </Link>
              ),
            }} />
        </>
      )}
      {weeks && weeks.length === 0 && !loading && (
        <p className="empty">{t("common.noGameData")}</p>
      )}

      {projHistory.length > 0 && (
        <>
          <h2>{t("player.reportCard")}</h2>
          <p className="sub">
            {t("player.reportCardSubHeur", { season: projEval?.data_season ?? "" })}
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
                  const prim = NCAA_PRIMARY[String(p.position)] ?? "receiving_yards";
                  const pv = p[`proj_${prim}`], av = p[`act_${prim}`];
                  const played = pv != null && av != null;
                  const diff = played ? Number(av) - Number(pv) : null;
                  const close = diff !== null
                    && Math.abs(diff) <= Math.max(15, Number(av) * 0.25);
                  return (
                    <tr key={String(p.week)}>
                      <td>W{String(p.week)}</td>
                      <td>
                        <Link to={`/ncaa/team/${p.opponent}`}>
                          {String(p.opponent ?? "—")}
                        </Link>
                      </td>
                      <td>{ncaaProjLine(p, "proj")}</td>
                      <td>{played ? ncaaProjLine(p, "act") : t("player.noData")}</td>
                      <td className={diff === null ? ""
                        : close ? "delta-good" : "delta-bad"}>
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
    </section>
  );
}
