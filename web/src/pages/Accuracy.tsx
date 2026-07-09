import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlayerScatterChart } from "../components/charts";
import { Loading } from "../components/Pickers";
import { label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

const BASE = `${import.meta.env.BASE_URL}data`;

interface EvalPayload {
  generated_at: string;
  data_season: number;
  method: string;
  weeks: { week: number; n: number;
           stats: Record<string, { n: number; mae: number; bias: number;
                                   corr: number | null }> }[];
  players: StatRow[];
}

const STAT_CHOICES = ["receiving_yards", "receptions", "targets",
                      "rushing_yards", "carries", "passing_yards",
                      "passing_tds", "receiving_tds"];
const POS_OF_STAT: Record<string, string[]> = {
  passing_yards: ["QB"], passing_tds: ["QB"],
  rushing_yards: ["RB", "QB"], carries: ["RB", "QB"],
  receiving_yards: ["WR", "TE", "RB"], receptions: ["WR", "TE", "RB"],
  targets: ["WR", "TE", "RB"], receiving_tds: ["WR", "TE"],
};

export default function Accuracy() {
  const [stat, setStat] = useState("receiving_yards");
  const { data, loading } = useAsync(async () => {
    try {
      const res = await fetch(`${BASE}/proj_eval.json`);
      if (!res.ok) return null;
      return (await res.json()) as EvalPayload;
    } catch { return null; }
  }, []);

  const statCols = useMemo(() => {
    const set = new Set<string>();
    for (const w of data?.weeks ?? [])
      for (const s of Object.keys(w.stats)) set.add(s);
    return STAT_CHOICES.filter((s) => set.has(s));
  }, [data]);

  const rows = useMemo(() => {
    const poss = POS_OF_STAT[stat] ?? [];
    return (data?.players ?? []).filter((p) =>
      poss.includes(String(p.position))
      && p[`proj_${stat}`] !== null && p[`act_${stat}`] !== null);
  }, [data, stat]);

  const tableRows = useMemo(() =>
    rows
      .map((p): StatRow => ({
        ...p,
        diff: Number((Number(p[`proj_${stat}`]) - Number(p[`act_${stat}`])).toFixed(1)),
      }))
      .sort((a, b) => Number(b[`act_${stat}`]) - Number(a[`act_${stat}`]))
      .slice(0, 40),
    [rows, stat]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">Karne henüz üretilmedi — pipeline'ı bekleyin.</p>;

  const lastWeek = data.weeks[data.weeks.length - 1]?.week;

  return (
    <section>
      <h1>Projeksiyon Karnesi</h1>
      <p className="sub">
        {data.data_season} sezonunun son {data.weeks.length} haftası geriye dönük
        test edildi: {data.method} MAE = ortalama mutlak hata; bias + ise model
        fazla iyimser; korelasyon 1'e yaklaştıkça sıralama isabeti artar.
        Sezon boyunca her Salı güncellenir.
      </p>

      <h2>Haftalık Doğruluk Özeti</h2>
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Hafta</th>
              {statCols.map((s) => <th key={s} colSpan={3}>{label(s)}</th>)}
            </tr>
            <tr>
              <th className="sub-th"></th>
              {statCols.map((s) => (
                <>
                  <th key={`${s}m`} className="sub-th">MAE</th>
                  <th key={`${s}b`} className="sub-th">Bias</th>
                  <th key={`${s}c`} className="sub-th">r</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.week}>
                <td>W{w.week}</td>
                {statCols.map((s) => {
                  const m = w.stats[s];
                  return m ? (
                    <>
                      <td key={`${s}m`} className="num">{m.mae}</td>
                      <td key={`${s}b`} className="num">
                        {m.bias > 0 ? `+${m.bias}` : m.bias}
                      </td>
                      <td key={`${s}c`} className="num"
                          style={{ color: (m.corr ?? 0) >= 0.5 ? "#3fb950"
                                   : (m.corr ?? 0) < 0.3 ? "#f0883e" : undefined }}>
                        {m.corr ?? "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td key={`${s}m`}>—</td><td key={`${s}b`}>—</td>
                      <td key={`${s}c`}>—</td>
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Tahmin vs Gerçekleşen — W{lastWeek}</h2>
      <div className="pill-row">
        {statCols.map((s) => (
          <button key={s} className={`pill small ${s === stat ? "active" : ""}`}
                  onClick={() => setStat(s)}>{label(s)}</button>
        ))}
      </div>
      <p className="sub">
        Köşegene (eğilim çizgisine) yakın noktalar isabetli tahminlerdir;
        çizginin üstü modelin eksik, altı fazla tahmin ettikleridir.
      </p>
      <PlayerScatterChart rows={rows} x={`proj_${stat}`} y={`act_${stat}`}
                          labelTop={8} />

      <h2>Oyuncu Detayı (gerçekleşene göre ilk 40)</h2>
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Oyuncu</th><th>Poz</th><th>Takım</th><th>Rakip</th>
              <th>Tahmin</th><th>Gerçek</th><th>Fark</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((p) => (
              <tr key={String(p.player_id)}>
                <td>
                  <Link to={`/player/${p.player_id}`}>{String(p.player_name)}</Link>
                </td>
                <td>{String(p.position)}</td>
                <td>{String(p.team)}</td>
                <td>{String(p.opponent)}</td>
                <td className="num">{String(p[`proj_${stat}`])}</td>
                <td className="num">{String(p[`act_${stat}`])}</td>
                <td className="num" style={{
                  color: Math.abs(Number(p.diff)) <= 15 ? "#3fb950" : "#f0883e",
                }}>
                  {Number(p.diff) > 0 ? `+${p.diff}` : String(p.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
