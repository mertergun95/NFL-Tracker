import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import TeamLogo from "./TeamLogo";
import StatusBadge from "./StatusBadge";
import { CHART, trendOf } from "./charts";
import {
  loadInjuries, loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks,
  loadProjections,
} from "../lib/data";
import { fmt, label, presetForPosition } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";

const TREND_COLOR = { hot: "#3fb950", cold: "#f0883e", flat: CHART.series1 };

/** Pozisyona göre gerçek stat projeksiyon satırı. */
function projStatLine(p: Record<string, unknown>): string {
  const v = (c: string) =>
    p[c] !== null && p[c] !== undefined ? String(p[c]) : "—";
  const pos = String(p.position);
  if (pos === "QB")
    return `${v("proj_completions")}/${v("proj_attempts")} · ${v("proj_passing_yards")} pas yd · ` +
           `${v("proj_passing_tds")} TD · ${v("proj_passing_interceptions")} int`;
  if (pos === "RB")
    return `${v("proj_carries")} koşu · ${v("proj_rushing_yards")} koşu yd · ` +
           `${v("proj_receptions")} rec · ${v("proj_receiving_yards")} rec yd`;
  return `${v("proj_targets")} tgt · ${v("proj_receptions")} rec · ` +
         `${v("proj_receiving_yards")} yd · ${v("proj_receiving_tds")} TD`;
}

interface Props {
  playerId: string | null;
  season: number;
  onClose: () => void;
}

/** Sağdan kayan oyuncu künyesi — grafiklerdeki noktalara tıklanınca açılır. */
export default function PlayerDrawer({ playerId, season, onClose }: Props) {
  const { data: index } = useAsync(() => loadPlayerIndex(), []);
  const { data: seasonRows } = useAsync(() => loadPlayerSeason(season), [season]);

  const { data: projections } = useAsync(() => loadProjections(), []);

  const meta = useMemo(
    () => index?.find((p) => p.player_id === playerId) ?? null,
    [index, playerId]);
  const row = useMemo(
    () => seasonRows?.find((p) => p.player_id === playerId) ?? null,
    [seasonRows, playerId]);
  const proj = useMemo(
    () => projections?.rows.find((p) => p.player_id === playerId) ?? null,
    [projections, playerId]);
  const currentTeam = String(meta?.current_team ?? proj?.team ?? "");

  // haftalık form: mini eğri + trend rengi
  const { data: weekRows } = useAsync(
    async () => (playerId ? loadPlayerWeeks(season) : null), [playerId, season]);
  const spark = useMemo(() => {
    if (!weekRows || !playerId) return null;
    const rows = weekRows
      .filter((r) => r.player_id === playerId && r.season_type === "REG")
      .sort((a, b) => Number(a.week) - Number(b.week));
    if (rows.length < 3) return null;
    return {
      data: rows.map((r) => ({ v: Number(r.fantasy_points_ppr ?? 0) })),
      trend: trendOf(rows, "fantasy_points_ppr"),
    };
  }, [weekRows, playerId]);

  // güncel sakatlık durumu
  const { data: injuryRows } = useAsync(() => loadInjuries(), []);
  const injury = useMemo(() => {
    if (!injuryRows || !playerId) return null;
    const mine = injuryRows.filter((r) => r.player_id === playerId);
    if (mine.length === 0) return null;
    return mine.sort((a, b) => Number(b.week ?? 0) - Number(a.week ?? 0))[0];
  }, [injuryRows, playerId]);

  const pos = String(meta?.position ?? row?.position ?? "");
  const stats = presetForPosition(pos || null);

  return (
    <>
      <div className={`drawer-backdrop ${playerId ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${playerId ? "open" : ""}`}>
        {playerId && (
          <>
            <button className="drawer-close" onClick={onClose}>✕</button>
            <div className="player-header">
              {meta?.headshot_url && (
                <img className="headshot" src={String(meta.headshot_url)} alt=""
                     onError={(e) => { e.currentTarget.style.display = "none"; }} />
              )}
              <div>
                <h2 style={{ margin: 0 }}>
                  {String(meta?.player_name ?? row?.player_name ?? playerId)}
                </h2>
                <p className="sub" style={{ margin: 0 }}>
                  {pos || "?"} · {teamName(String(row?.team ?? meta?.team ?? ""))}
                </p>
              </div>
            </div>
            {meta && (
              <p className="sub">
                {meta.height ? `${meta.height} inç · ` : ""}
                {meta.weight ? `${meta.weight} lbs · ` : ""}
                {meta.college_name ? `${meta.college_name} · ` : ""}
                {meta.rookie_season ? `çaylak: ${meta.rookie_season}` : ""}
              </p>
            )}
            {injury?.report_status && (
              <p style={{ margin: "4px 0" }}>
                <StatusBadge status={String(injury.report_status)}
                             note={String(injury.report_primary_injury ?? "")} />
              </p>
            )}
            {spark && (
              <div className="drawer-spark">
                <div className="tile-label">
                  Haftalık PPR formu{" "}
                  <span className={`trend-chip ${spark.trend.kind}`}
                        style={{ padding: "1px 8px", fontSize: "0.72rem" }}>
                    {spark.trend.kind === "hot" ? "🔥 yükselişte"
                      : spark.trend.kind === "cold" ? "🧊 düşüşte" : "stabil"}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={54}>
                  <LineChart data={spark.data}
                             margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
                    <Line dataKey="v" type="monotone" dot={false}
                          stroke={TREND_COLOR[spark.trend.kind]} strokeWidth={2}
                          isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {currentTeam && currentTeam !== String(row?.team ?? "") && (
              <p className="sub">
                Güncel takım: <TeamLogo abbr={currentTeam} size={18} />{" "}
                {teamName(currentTeam)}
              </p>
            )}
            {proj && projections && (
              <div className="drawer-proj">
                <div className="tile-label">
                  Sıradaki maç — {projections.target.season} W{projections.target.week}
                </div>
                <div className="drawer-proj-line">
                  <span>
                    vs <TeamLogo abbr={String(proj.opponent)} size={18} />{" "}
                    {String(proj.opponent)}
                  </span>
                </div>
                <div className="drawer-proj-stats">
                  {projStatLine(proj)}
                </div>
                <div className="drawer-proj-sub">
                  çarpanlar: matchup {fmt("matchup_factor", proj.matchup_factor)}
                  {" · "}şema {fmt("scheme_factor", proj.scheme_factor)}
                  {" · "}snap {fmt("snap_factor", proj.snap_factor)}
                </div>
              </div>
            )}
            {row ? (
              <div className="drawer-stats">
                <div className="drawer-row">
                  <span>Maç</span><strong>{fmt("games", row.games)}</strong>
                </div>
                {stats.map((s) => (
                  <div className="drawer-row" key={s}>
                    <span>{label(s)}</span><strong>{fmt(s, row[s])}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">{season} sezonunda istatistik yok.</p>
            )}
            <Link className="drawer-link" to={`/player/${playerId}`} onClick={onClose}>
              Profili aç →
            </Link>
          </>
        )}
      </aside>
    </>
  );
}
