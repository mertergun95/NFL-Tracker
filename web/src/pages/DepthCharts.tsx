import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import { loadOptional } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS, teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";

const FORMATIONS: [string, string][] = [
  ["offense", "Hücum"],
  ["defense", "Savunma"],
  ["st", "Özel Takımlar"],
];

// formation etiketi ("3WR 1TE", "Base 3-4 D", "Special Teams"…) -> birim
function unitOf(formation: string): string {
  const f = formation.toLowerCase();
  if (f.includes("special")) return "st";
  if (f.includes("base") || /\bd$/.test(f) || f.includes("defen")) return "defense";
  return "offense";
}

// pozisyonları mantıklı sırada göster
const POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT",
  "DE", "DT", "NT", "EDGE", "OLB", "ILB", "MLB", "LB", "CB", "NB", "SS", "FS", "S",
  "K", "P", "LS", "KR", "PR", "H"];

export default function DepthCharts() {
  const [team, setTeam] = useState("KC");
  const [formation, setFormation] = useState("offense");
  const { data, loading } = useAsync(() => loadOptional("depth_charts.json"), []);

  const season = data?.[0]?.season;

  const groups = useMemo(() => {
    if (!data) return [];
    const rows = data.filter((r) => r.team === team
      && unitOf(String(r.formation ?? "")) === formation);
    const byPos = new Map<string, StatRow[]>();
    for (const r of rows) {
      const pos = String(r.position ?? "?");
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push(r);
    }
    return [...byPos.entries()]
      .map(([pos, players]) => ({
        pos,
        players: players.sort((a, b) => Number(a.depth) - Number(b.depth)),
      }))
      .sort((a, b) => {
        const ia = POS_ORDER.indexOf(a.pos), ib = POS_ORDER.indexOf(b.pos);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
  }, [data, team, formation]);

  if (loading) return <Loading />;
  if (!data)
    return (
      <p className="empty">
        Kadro verisi henüz üretilmedi — pipeline'ın bir sonraki koşusunu bekleyin.
      </p>
    );

  return (
    <section>
      <h1>Kadrolar — Depth Chart{season ? ` (${season})` : ""}</h1>
      <p className="sub">
        Güncel derinlik şeması: her pozisyonda 1 numara en üstte.
        Kaynak: NFL resmi depth chart verisi (nflverse), her Salı güncellenir.
      </p>
      <div className="logo-grid">
        {Object.keys(TEAMS).map((t) => (
          <button key={t} className={`logo-btn ${t === team ? "active" : ""}`}
                  title={teamName(t)} onClick={() => setTeam(t)}>
            <TeamLogo abbr={t} size={34} />
          </button>
        ))}
      </div>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TeamLogo abbr={team} size={30} /> {teamName(team)}
      </h2>
      <div className="pill-row">
        {FORMATIONS.map(([key, lbl]) => (
          <button key={key} className={`pill ${formation === key ? "active" : ""}`}
                  onClick={() => setFormation(key)}>{lbl}</button>
        ))}
      </div>
      <div className="depth-grid">
        {groups.map(({ pos, players }) => (
          <div className="depth-card" key={pos}>
            <h3>{pos}</h3>
            <ol>
              {players.map((p, i) => (
                <li key={`${p.player_id}-${i}`}
                    className={Number(p.depth) === 1 ? "starter" : ""}>
                  <span className="depth-no">{String(p.depth)}</span>
                  {p.player_id ? (
                    <Link to={`/player/${p.player_id}`}>
                      {String(p.player_name)}
                    </Link>
                  ) : (
                    <span>{String(p.player_name)}</span>
                  )}
                  {p.jersey !== null && p.jersey !== undefined && (
                    <span className="jersey">#{String(p.jersey)}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {groups.length === 0 && (
        <p className="empty">Bu takım/birim için kayıt yok.</p>
      )}
    </section>
  );
}
