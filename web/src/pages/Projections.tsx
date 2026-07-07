import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import { Loading } from "../components/Pickers";
import { loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

const COLS = ["player_name", "team", "opponent", "proj_ppr", "proj_stat",
              "recent_avg", "season_avg", "matchup_factor"];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
};

export default function Projections() {
  const [pos, setPos] = useState("WR");
  const { data, loading } = useAsync(() => loadProjections(), []);

  const rows = useMemo(
    () => (data?.rows ?? []).filter(POS_FILTER[pos] ?? (() => true)),
    [data, pos]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">Projeksiyonlar henüz üretilmedi — Salı pipeline'ını bekleyin.</p>;

  return (
    <section>
      <h1>Haftalık Projeksiyonlar — {data.target.season} W{data.target.week}</h1>
      <p className="sub">
        Model: son 5 maçın ağırlıklı ortalaması (%60) + sezon ortalaması (%40),
        rakibin pozisyona karşı verdiği PPR'a göre çarpan (0.80–1.25 aralığında).
        Veri: {data.data_season} sezonu. "Proj Yds" QB'de pas, RB'de koşu,
        WR/TE'de rec yardası projeksiyonudur.
      </p>
      <div className="pill-row">
        {["QB", "RB", "WR", "TE"].map((p) => (
          <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                  onClick={() => setPos(p)}>{p}</button>
        ))}
      </div>
      <StatTable rows={rows} columns={COLS} defaultSort="proj_ppr" maxRows={60}
        render={{
          player_name: (row) => (
            <Link to={`/player/${row.player_id}`}>{String(row.player_name)}</Link>
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
