import { useMemo } from "react";
import { Link } from "react-router-dom";
import { loadPlayerIndex, loadPlayerSeason } from "../lib/data";
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

  const meta = useMemo(
    () => index?.find((p) => p.player_id === playerId) ?? null,
    [index, playerId]);
  const row = useMemo(
    () => seasonRows?.find((p) => p.player_id === playerId) ?? null,
    [seasonRows, playerId]);

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
