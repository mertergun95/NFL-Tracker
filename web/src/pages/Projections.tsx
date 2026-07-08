import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import StatusBadge from "../components/StatusBadge";
import { Loading } from "../components/Pickers";
import { loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

const COLS = ["player_name", "team", "opponent", "proj_ppr", "proj_stat",
              "recent_avg", "season_avg", "matchup_factor", "scheme_factor",
              "snap_factor", "injury_status"];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
};

export default function Projections() {
  const [pos, setPos] = useState("WR");
  const [view, setView] = useState<"pos" | "game">("pos");
  const [gameKey, setGameKey] = useState<string | null>(null);
  const { data, loading } = useAsync(() => loadProjections(), []);

  const rows = useMemo(
    () => (data?.rows ?? []).filter(POS_FILTER[pos] ?? (() => true)),
    [data, pos]);

  // maç bazlı gruplama: away@home anahtarı (takım-rakip çiftinden)
  const games = useMemo(() => {
    const set = new Map<string, [string, string]>();
    for (const p of data?.rows ?? []) {
      const t = String(p.team), o = String(p.opponent);
      const key = [t, o].sort().join("@");
      if (!set.has(key)) set.set(key, [t, o]);
    }
    return [...set.entries()];
  }, [data]);
  const activeGame = gameKey ?? games[0]?.[0] ?? null;
  const gameTeams = games.find(([k]) => k === activeGame)?.[1] ?? null;
  const gameRows = useMemo(
    () => gameTeams
      ? (data?.rows ?? []).filter((p) => gameTeams.includes(String(p.team)))
      : [],
    [data, gameTeams]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">Projeksiyonlar henüz üretilmedi — Salı pipeline'ını bekleyin.</p>;

  return (
    <section>
      <h1>Haftalık Projeksiyonlar — {data.target.season} W{data.target.week}</h1>
      <p className="sub">
        Model v2: son 5 maçın ağırlıklı formu (%60) + sezon ortalaması (%40)
        × <strong>matchup</strong> (rakibin pozisyona verdiği)
        × <strong>şema</strong> (blitz/box/coverage uyumu)
        × <strong>snap trendi</strong> (son 3 haftanın snap payı)
        × <strong>sakatlık</strong> (Out/Doubtful hariç, Questionable −%10).
        Takımlar <strong>güncel kadrolardan</strong> alınır. Veri: {data.data_season} sezonu.
      </p>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${view === "pos" ? "active" : ""}`}
                  onClick={() => setView("pos")}>Pozisyona göre</button>
          <button className={`pill ${view === "game" ? "active" : ""}`}
                  onClick={() => setView("game")}>Maça göre</button>
        </div>
        {view === "pos" && (
          <div className="pill-row">
            {["QB", "RB", "WR", "TE"].map((p) => (
              <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                      onClick={() => setPos(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>
      {view === "game" && (
        <div className="pill-row">
          {games.map(([key, [a, b]]) => (
            <button key={key} className={`pill small ${key === activeGame ? "active" : ""}`}
                    onClick={() => setGameKey(key)}>{a} – {b}</button>
          ))}
        </div>
      )}
      <StatTable rows={view === "game" ? gameRows : rows}
        columns={view === "game" ? ["player_name", "position", ...COLS.slice(1)] : COLS}
        defaultSort="proj_ppr" maxRows={60}
        render={{
          player_name: (row) => (
            <Link to={`/player/${row.player_id}`}>{String(row.player_name)}</Link>
          ),
          injury_status: (row) => (
            <StatusBadge status={row.injury_status as string}
                         note={row.injury_note as string} />
          ),
          team: (row) => <Link to={`/team/${row.team}`}>{String(row.team)}</Link>,
          opponent: (row) => (
            <Link to={`/team/${row.opponent}`}>{String(row.opponent)}</Link>
          ),
        }}
      />
    </section>
  );
}
