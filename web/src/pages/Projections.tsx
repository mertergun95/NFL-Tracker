import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import StatusBadge from "../components/StatusBadge";
import { Loading } from "../components/Pickers";
import { loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

// pozisyona göre gösterilecek GERÇEK stat projeksiyonları
const POS_COLS: Record<string, string[]> = {
  QB: ["proj_attempts", "proj_completions", "proj_passing_yards",
       "proj_passing_tds", "proj_passing_interceptions", "proj_carries",
       "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds",
       "proj_targets", "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_targets", "proj_receptions", "proj_receiving_yards",
       "proj_receiving_tds"],
  TE: ["proj_targets", "proj_receptions", "proj_receiving_yards",
       "proj_receiving_tds"],
};
const POS_SORT: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards",
  WR: "proj_receiving_yards", TE: "proj_receiving_yards",
};
const FACTOR_COLS = ["matchup_factor", "scheme_factor", "snap_factor",
                     "injury_status"];
const GAME_COLS = ["proj_passing_yards", "proj_carries", "proj_rushing_yards",
                   "proj_targets", "proj_receptions", "proj_receiving_yards"];

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
        <strong>Gerçek istatistik tahminleri</strong> (P· = projeksiyon):
        her stat için son 5 maçın ağırlıklı formu (%60) + sezon ortalaması (%40)
        × o statın <strong>kendi matchup çarpanı</strong> (rakibin o pozisyona
        o statta verdiği / lig ort.) × <strong>şema uyumu</strong>
        × <strong>snap trendi</strong> × <strong>sakatlık</strong> (Out/Doubtful
        hariç, Questionable −%10). Takımlar güncel kadrolardan.
        Doğruluk geçmişi için <Link to="/accuracy">Karne</Link> sayfasına bak.
        Veri: {data.data_season} sezonu.
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
        columns={view === "game"
          ? ["player_name", "position", "team", "opponent", ...GAME_COLS,
             "injury_status"]
          : ["player_name", "team", "opponent", ...(POS_COLS[pos] ?? []),
             ...FACTOR_COLS]}
        defaultSort={view === "game" ? "proj_receiving_yards" : POS_SORT[pos]}
        maxRows={60}
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
