import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CompareLineChart, SERIES_COLORS } from "../components/charts";
import { Loading, SeasonPicker } from "../components/Pickers";
import { loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks } from "../lib/data";
import { fmt, label, presetForPosition } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

const MAX_PLAYERS = 3;

export default function Compare({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const [ids, setIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statChoice, setStatChoice] = useState<string | null>(null);

  const { data: index } = useAsync(() => loadPlayerIndex(), []);
  const { data: seasonRows } = useAsync(() => loadPlayerSeason(season), [season]);
  const { data: weekRows, loading } = useAsync(() => loadPlayerWeeks(season), [season]);

  const suggestions = useMemo(() => {
    if (!index || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return index
      .filter((p) => String(p.player_name ?? "").toLowerCase().includes(q)
                     && !ids.includes(String(p.player_id)))
      .sort((a, b) => {
        // kelime başında eşleşen ve güncel sezonda oynayan öne gelsin
        const score = (p: typeof a) => {
          const name = String(p.player_name ?? "").toLowerCase();
          const wordStart = name.split(/\s+/).some((w) => w.startsWith(q)) ? 100 : 0;
          return wordStart + Number(p.last_season ?? 0) - 2000;
        };
        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [index, query, ids]);

  const players = useMemo(
    () => ids
      .map((pid) => ({
        id: pid,
        season: seasonRows?.find((r) => r.player_id === pid) ?? null,
        weeks: (weekRows ?? [])
          .filter((r) => r.player_id === pid && r.season_type === "REG")
          .sort((a, b) => Number(a.week) - Number(b.week)),
        meta: index?.find((r) => r.player_id === pid) ?? null,
      })),
    [ids, seasonRows, weekRows, index]);

  const pos = String(players[0]?.meta?.position ?? players[0]?.season?.position ?? "");
  const stats = presetForPosition(pos || null);
  const chartStat = statChoice && stats.includes(statChoice) ? statChoice : stats[0];

  const series = players
    .filter((p) => p.weeks.length > 0)
    .map((p) => ({
      name: String(p.meta?.player_name ?? p.season?.player_name ?? p.id),
      rows: p.weeks as StatRow[],
    }));

  return (
    <section>
      <h1>Oyuncu Karşılaştırma</h1>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <input className="search" placeholder="Oyuncu ekle (en az 2 harf)…"
               value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {suggestions.length > 0 && (
        <div className="pill-row">
          {suggestions.map((p) => (
            <button key={String(p.player_id)} className="pill"
                    onClick={() => {
                      if (ids.length < MAX_PLAYERS)
                        setIds([...ids, String(p.player_id)]);
                      setQuery("");
                    }}>
              + {String(p.player_name)} ({String(p.position ?? "?")}, {String(p.team ?? "?")})
            </button>
          ))}
        </div>
      )}
      <div className="pill-row">
        {players.map((p, i) => (
          <button key={p.id} className="pill active"
                  style={{ background: SERIES_COLORS[i], borderColor: SERIES_COLORS[i] }}
                  onClick={() => setIds(ids.filter((x) => x !== p.id))}>
            {String(p.meta?.player_name ?? p.id)} ✕
          </button>
        ))}
      </div>

      {ids.length === 0 && (
        <p className="empty">
          Karşılaştırmak için {MAX_PLAYERS}'e kadar oyuncu ekleyin —
          örn. aynı pozisyondan iki yıldız.
        </p>
      )}

      {ids.length > 0 && (
        <>
          <h2>Sezon Toplamları ({season}, REG)</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>İstatistik</th>
                  {players.map((p) => (
                    <th key={p.id}>
                      <Link to={`/player/${p.id}`}>
                        {String(p.meta?.player_name ?? p.id)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["team", "games", ...stats].map((s) => (
                  <tr key={s}>
                    <td>{label(s)}</td>
                    {players.map((p) => (
                      <td key={p.id} className="num">
                        {p.season ? fmt(s, p.season[s] ?? null) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Hafta Hafta</h2>
          <div className="pill-row">
            {stats.map((s) => (
              <button key={s} className={`pill small ${s === chartStat ? "active" : ""}`}
                      onClick={() => setStatChoice(s)}>
                {label(s)}
              </button>
            ))}
          </div>
          {loading && <Loading />}
          {series.length > 0 && <CompareLineChart series={series} stat={chartStat} />}
        </>
      )}
    </section>
  );
}
