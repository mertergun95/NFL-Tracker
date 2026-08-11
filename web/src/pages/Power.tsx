/** Güç sıralaması — hücum ve savunma ayrı, NFL ve NCAA ortak sayfa.
 *
 *  Reyting "lig ortalamasına göre maç başına puan" cinsinden ve rakibe göre
 *  düzeltilmiş: +6.0 hücum, ortalama bir savunmaya karşı lig ortalamasından
 *  6 puan fazla atmak demek. Savunmada da + iyi (o kadar az yediriyor).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import NcaaLogo from "../components/NcaaLogo";
import { Loading } from "../components/Pickers";
import { loadOptional } from "../lib/data";
import { loadNcaaTeams } from "../lib/ncaa";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import { useT } from "../lib/i18n";
import type { StatRow } from "../lib/types";

type Side = "overall" | "off" | "def";

const COLS: Record<Side, { rank: string; rating: string }> = {
  overall: { rank: "overall_rank", rating: "overall_rating" },
  off: { rank: "off_rank", rating: "off_rating" },
  def: { rank: "def_rank", rating: "def_rating" },
};

/** Bir önceki haftaya göre sıra değişimi. */
function Trend({ now, prev }: { now: unknown; prev: unknown }) {
  if (typeof now !== "number" || typeof prev !== "number" || now === prev) {
    return <span className="pw-flat">–</span>;
  }
  const diff = prev - now; // sıra küçüldüyse yükselmiş
  return (
    <span className={diff > 0 ? "pw-up" : "pw-down"}>
      {diff > 0 ? "▲" : "▼"}{Math.abs(diff)}
    </span>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 50);
  return (
    <div className="pw-bar">
      <div className="pw-bar-mid" />
      <div
        className={`pw-bar-fill ${value >= 0 ? "pos" : "neg"}`}
        style={{ width: `${pct}%`, [value >= 0 ? "left" : "right"]: "50%" }}
      />
    </div>
  );
}

export default function Power({ league = "nfl" }: { league?: "nfl" | "ncaa" }) {
  const t = useT();
  const [side, setSide] = useState<Side>("overall");
  const path = league === "ncaa" ? "ncaa/power.json" : "power.json";
  const { data, loading } = useAsync(() => loadOptional(path), [path]);
  const { data: ncaaTeams } = useAsync(
    () => (league === "ncaa" ? loadNcaaTeams() : Promise.resolve(null)), [league]);

  const logoOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of ncaaTeams ?? []) m.set(String(r.team), String(r.logo ?? ""));
    return m;
  }, [ncaaTeams]);

  const rows = useMemo(() => {
    const col = COLS[side].rank;
    return [...(data ?? [])].sort(
      (a, b) => Number(a[col] ?? 999) - Number(b[col] ?? 999));
  }, [data, side]);

  const max = useMemo(() => {
    const col = COLS[side].rating;
    return Math.max(1, ...rows.map((r) => Math.abs(Number(r[col] ?? 0))));
  }, [rows, side]);

  if (loading) return <Loading />;
  if (!data || data.length === 0)
    return <p className="empty">{t("power.notReady")}</p>;

  const { rank: rankCol, rating: ratingCol } = COLS[side];
  const prevCol = side === "off" ? "off_prev_rank"
    : side === "def" ? "def_prev_rank" : null;

  return (
    <section>
      <h1>{t("power.title")}</h1>
      <p className="sub">{t("power.sub")}</p>

      <div className="pill-row">
        {(["overall", "off", "def"] as Side[]).map((s) => (
          <button key={s} className={`pill ${s === side ? "active" : ""}`}
                  onClick={() => setSide(s)}>
            {t(`power.${s}`)}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th style={{ width: 46 }}>#</th>
              <th>{t("common.team")}</th>
              <th className="num">{t("power.rating")}</th>
              <th style={{ width: 120 }}></th>
              {prevCol ? <th className="num">{t("power.trend")}</th> : null}
              <th className="num">{t("power.offRank")}</th>
              <th className="num">{t("power.defRank")}</th>
              <th className="num">{t("power.ppg")}</th>
              <th className="num">{t("power.papg")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: StatRow) => {
              const abbr = String(r.team);
              const rating = Number(r[ratingCol] ?? 0);
              return (
                <tr key={abbr}>
                  <td className="num pw-rank">{String(r[rankCol] ?? "—")}</td>
                  <td>
                    <Link to={league === "ncaa" ? `/ncaa/team/${abbr}` : `/team/${abbr}`}
                          className="team-cell">
                      {league === "ncaa"
                        ? <NcaaLogo src={logoOf.get(abbr)} size={20} />
                        : <TeamLogo abbr={abbr} size={20} />}
                      {" "}{league === "ncaa" ? abbr : teamName(abbr)}
                    </Link>
                  </td>
                  <td className="num">{rating > 0 ? `+${rating.toFixed(1)}` : rating.toFixed(1)}</td>
                  <td><Bar value={rating} max={max} /></td>
                  {prevCol ? (
                    <td className="num"><Trend now={r[rankCol]} prev={r[prevCol]} /></td>
                  ) : null}
                  <td className="num">{String(r.off_rank ?? "—")}</td>
                  <td className="num">{String(r.def_rank ?? "—")}</td>
                  <td className="num">{String(r.ppg ?? "—")}</td>
                  <td className="num">{String(r.papg ?? "—")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="ag-foot">{t("power.method")}</p>
    </section>
  );
}
