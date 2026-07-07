import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CompareLineChart, SERIES_COLORS } from "../components/charts";
import { Loading } from "../components/Pickers";
import { loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks } from "../lib/data";
import { fmt, label, presetForPosition } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

const MAX_PLAYERS = 3;
// düşükken iyi olan istatistikler (vurgu ters çevrilir)
const LOWER_BETTER = new Set(["passing_interceptions", "sacks_suffered",
                              "rushing_fumbles", "rushing_fumbles_lost"]);

interface Sel { id: string; season: number }

export default function Compare({ seasons }: { seasons: number[] }) {
  const [sel, setSel] = useState<Sel[]>([]);
  const [query, setQuery] = useState("");
  const [statChoice, setStatChoice] = useState<string | null>(null);
  const [cumulative, setCumulative] = useState(false);

  const { data: index } = useAsync(() => loadPlayerIndex(), []);

  const suggestions = useMemo(() => {
    if (!index || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return index
      .filter((p) => String(p.player_name ?? "").toLowerCase().includes(q)
                     && !sel.some((s) => s.id === p.player_id))
      .sort((a, b) => {
        const score = (p: typeof a) => {
          const name = String(p.player_name ?? "").toLowerCase();
          const wordStart = name.split(/\s+/).some((w) => w.startsWith(q)) ? 100 : 0;
          return wordStart + Number(p.last_season ?? 0) - 2000;
        };
        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [index, query, sel]);

  // Seçilen her (oyuncu, sezon) için veri
  const { data: playerData, loading } = useAsync(async () => {
    return Promise.all(sel.map(async (s) => {
      const [seasonRows, weekRows] = await Promise.all([
        loadPlayerSeason(s.season).catch(() => [] as StatRow[]),
        loadPlayerWeeks(s.season).catch(() => [] as StatRow[]),
      ]);
      return {
        ...s,
        season_row: seasonRows.find((r) => r.player_id === s.id) ?? null,
        weeks: weekRows
          .filter((r) => r.player_id === s.id && r.season_type === "REG")
          .sort((a, b) => Number(a.week) - Number(b.week)),
      };
    }));
  }, [JSON.stringify(sel)]);

  const players = playerData ?? [];
  const nameOf = (s: Sel) =>
    String(index?.find((p) => p.player_id === s.id)?.player_name ?? s.id);
  const colName = (s: Sel) => `${nameOf(s)} (${s.season})`;

  const pos = String(players[0]?.season_row?.position
    ?? index?.find((p) => p.player_id === sel[0]?.id)?.position ?? "");
  const stats = presetForPosition(pos || null);
  const chartStat = statChoice && stats.includes(statChoice) ? statChoice : stats[0];

  const series = players
    .filter((p) => p.weeks.length > 0)
    .map((p) => ({
      name: colName(p),
      rows: cumulative
        ? p.weeks.reduce<StatRow[]>((acc, r) => {
            const prev = acc.length ? Number(acc[acc.length - 1][chartStat] ?? 0) : 0;
            acc.push({ ...r, [chartStat]: prev + Number(r[chartStat] ?? 0) });
            return acc;
          }, [])
        : p.weeks,
    }));

  const bestIdx = (s: string): number => {
    const vals = players.map((p) => Number(p.season_row?.[s] ?? NaN));
    if (vals.filter((v) => !Number.isNaN(v)).length < 2) return -1;
    const pick = LOWER_BETTER.has(s) ? Math.min : Math.max;
    const best = pick(...vals.filter((v) => !Number.isNaN(v)));
    return vals.indexOf(best);
  };

  return (
    <section>
      <h1>Oyuncu Karşılaştırma</h1>
      <p className="sub">
        {MAX_PLAYERS}'e kadar oyuncu ekle; her oyuncu için sezonu ayrı seçebilirsin
        (ör. 2024 Chase vs 2025 JSN). Yeşil değer satırın en iyisidir.
      </p>
      <div className="toolbar">
        <input className="search" placeholder="Oyuncu ekle (en az 2 harf)…"
               value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {suggestions.length > 0 && (
        <div className="pill-row">
          {suggestions.map((p) => (
            <button key={String(p.player_id)} className="pill"
                    onClick={() => {
                      if (sel.length < MAX_PLAYERS)
                        setSel([...sel, { id: String(p.player_id),
                                          season: Number(p.last_season ?? seasons[0]) }]);
                      setQuery("");
                    }}>
              + {String(p.player_name)} ({String(p.position ?? "?")}, {String(p.team ?? "?")})
            </button>
          ))}
        </div>
      )}
      <div className="pill-row">
        {sel.map((s, i) => (
          <span key={s.id} className="compare-chip"
                style={{ borderColor: SERIES_COLORS[i] }}>
            <strong style={{ color: SERIES_COLORS[i] }}>{nameOf(s)}</strong>
            <select className="axis-select small" value={s.season}
                    onChange={(e) => {
                      const next = [...sel];
                      next[i] = { ...s, season: Number(e.target.value) };
                      setSel(next);
                    }}>
              {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="chip-x"
                    onClick={() => setSel(sel.filter((x) => x.id !== s.id))}>✕</button>
          </span>
        ))}
      </div>

      {sel.length === 0 && (
        <p className="empty">Karşılaştırmak için oyuncu ekleyin.</p>
      )}
      {loading && <Loading />}

      {players.length > 0 && (
        <>
          <h2>Sezon Toplamları (REG)</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>İstatistik</th>
                  {players.map((p) => (
                    <th key={p.id + p.season}>
                      <Link to={`/player/${p.id}`}>{colName(p)}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["team", "games", ...stats].map((s) => {
                  const best = bestIdx(s);
                  return (
                    <tr key={s}>
                      <td>{label(s)}</td>
                      {players.map((p, i) => (
                        <td key={p.id + p.season} className="num"
                            style={i === best ? { color: "#3fb950", fontWeight: 600 } : undefined}>
                          {p.season_row ? fmt(s, p.season_row[s] ?? null) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2>Hafta Hafta</h2>
          <div className="toolbar">
            <div className="pill-row">
              {stats.map((s) => (
                <button key={s} className={`pill small ${s === chartStat ? "active" : ""}`}
                        onClick={() => setStatChoice(s)}>
                  {label(s)}
                </button>
              ))}
            </div>
            <button className={`pill small ${cumulative ? "active" : ""}`}
                    onClick={() => setCumulative(!cumulative)}>
              Σ Kümülatif
            </button>
          </div>
          {series.length > 0 && <CompareLineChart series={series} stat={chartStat} />}
        </>
      )}
    </section>
  );
}
