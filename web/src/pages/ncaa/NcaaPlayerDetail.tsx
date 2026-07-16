import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { trendOf, WeeklyBarChart } from "../../components/charts";
import { fmt as fmtStat, label } from "../../lib/columns";
import { loadNcaaPlayerIndex, loadNcaaPlayerSeason, loadNcaaPlayerWeeks,
         ncaaPreset } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import type { StatRow } from "../../lib/types";

export default function NcaaPlayerDetail({ seasons }: { seasons: number[] }) {
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
            {" · NCAA FBS"}
          </p>
        </div>
      </div>

      <h2>Kariyer (sezon toplamları, REG)</h2>
      {careerErr && <ErrorMsg msg={careerErr} />}
      {career && (
        <StatTable rows={career} columns={["season", "team", "games", ...stats]}
                   defaultSort="season" />
      )}

      <h2>Haftalık Game Log</h2>
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
              const t = trendOf(weeks, chartStat);
              const txt = t.kind === "hot" ? "🔥 Yükselişte"
                : t.kind === "cold" ? "🧊 Düşüşte" : "— Stabil";
              return (
                <span className={`trend-chip ${t.kind}`}>
                  {txt} · son 3: {t.recent.toFixed(1)} vs sezon: {t.season.toFixed(1)}
                </span>
              );
            })()}
          </div>
          {threshold !== null && overCount && (
            <div className="toolbar" style={{ marginBottom: 4 }}>
              <span className="thr-chip">
                🎯 Eşik <strong>{fmtStat(chartStat, threshold)}</strong>
                {" — "}
                <strong>{overCount.over}/{overCount.total}</strong> maçta eşiğin
                üzerinde (%{overCount.pct})
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
        <p className="empty">Bu sezon için maç verisi yok.</p>
      )}
    </section>
  );
}
