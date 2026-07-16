import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PName from "../../components/PName";
import { Loading } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaProjections } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";

const POS_COLS: Record<string, string[]> = {
  QB: ["proj_completions", "proj_attempts", "proj_passing_yards",
       "proj_passing_tds", "proj_passing_interceptions", "proj_carries",
       "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds",
       "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
  TE: ["proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
};
const PRIMARY: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards",
  WR: "proj_receiving_yards", TE: "proj_receiving_yards",
};

export default function NcaaProjections() {
  const [pos, setPos] = useState("QB");
  const [q, setQ] = useState("");
  const { data, loading } = useAsync(() => loadNcaaProjections(), []);

  const rows = useMemo(() => {
    let r = (data?.rows ?? []).filter((p) => String(p.position) === pos);
    const s = q.trim().toLowerCase();
    if (s)
      r = r.filter((p) => String(p.player_name).toLowerCase().includes(s)
        || String(p.team).toLowerCase().includes(s));
    return r;
  }, [data, pos, q]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">NCAA projeksiyonları henüz üretilmedi.</p>;

  return (
    <section>
      <h1>NCAA Haftalık Projeksiyonlar</h1>
      <p className="sub">
        Hedef: <strong>{data.target.season} · Hafta {data.target.week}</strong>
        {" "}· motor: sezgisel (son sezon form ortalaması × rakibin geçen
        sezonki savunma çarpanı) · güncel kadrolar esas alınır (transfer
        portal dahil); geçmiş verisi olmayan oyuncular (ör. gerçek freshman'ler)
        listelenmez.
      </p>
      <div className="toolbar">
        <div className="pill-row">
          {Object.keys(POS_COLS).map((p) => (
            <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                    onClick={() => setPos(p)}>{p}</button>
          ))}
        </div>
        <input className="axis-select" placeholder="Oyuncu / takım ara…"
               value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <StatTable rows={rows}
        columns={["player_name", "team", "opponent", ...POS_COLS[pos]]}
        defaultSort={PRIMARY[pos]}
        maxRows={80}
        render={{
          player_name: (r) => (
            <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                   id={String(r.player_id)} base="/ncaa/player" />
          ),
          team: (r) => (
            <Link to={`/ncaa/team/${r.team}`}>{String(r.team)}</Link>
          ),
          opponent: (r) => (
            <Link to={`/ncaa/team/${r.opponent}`}>
              {(r.is_home ? "vs " : "@ ") + String(r.opponent)}
            </Link>
          ),
        }} />
    </section>
  );
}
