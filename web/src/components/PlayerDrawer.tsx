import { useMemo } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import { loadPlayerIndex, loadPlayerSeason, loadProjections } from "../lib/data";
import { fmt, label, presetForPosition } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";

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
                  <strong>Proj: {fmt("proj_ppr", proj.proj_ppr)} PPR</strong>
                </div>
                <div className="drawer-proj-sub">
                  matchup çarpanı {fmt("matchup_factor", proj.matchup_factor)} ·
                  son 5: {fmt("recent_avg", proj.recent_avg)}
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
