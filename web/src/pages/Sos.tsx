/** Fikstür zorluğu (PFF strength of schedule) — yalnızca NFL.
 *
 *  Ölçek 0-10 ve **yüksek = kolay maç**; bu yön tahmin edilmedi, ölçüldü
 *  (haftalık SOS ile o hafta karşılaşılan rakibin savunma reytingi arasında
 *  r = -0.48, n = 512). Hücre rengi de bu yöne göre: yeşil kolay, kırmızı zor.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import { loadSos } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import { useT } from "../lib/i18n";

const POSITIONS = ["QB", "RB", "WR", "TE", "DST"];
const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);

/** 0-10 -> renk. Ortada nötr, uçlarda doygun. */
function cellStyle(v: number | null): React.CSSProperties {
  if (v === null) return {};
  const t = Math.max(0, Math.min(1, v / 10));
  // 0 = kırmızı (zor), 1 = yeşil (kolay)
  const hue = t * 130;
  const alpha = 0.12 + Math.abs(t - 0.5) * 0.5;
  return { background: `hsl(${hue} 65% 45% / ${alpha})` };
}

export default function Sos() {
  const t = useT();
  const [pos, setPos] = useState("RB");
  const { data, loading } = useAsync(() => loadSos(), []);

  const rows = useMemo(() => {
    return (data ?? [])
      .filter((r) => r.position === pos)
      .sort((a, b) => Number(a.season_rank ?? 99) - Number(b.season_rank ?? 99));
  }, [data, pos]);

  if (loading) return <Loading />;
  if (!data || data.length === 0)
    return <p className="empty">{t("sos.notReady")}</p>;

  return (
    <section>
      <h1>{t("sos.title")}</h1>
      <p className="sub">{t("sos.sub")}</p>

      <div className="pill-row">
        {POSITIONS.map((p) => (
          <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                  onClick={() => setPos(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="stat-table sos-table">
          <thead>
            <tr>
              <th style={{ width: 46 }}>#</th>
              <th>{t("common.team")}</th>
              {WEEKS.map((w) => <th key={w} className="num">{w}</th>)}
              <th className="num">{t("sos.season")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const abbr = String(r.team);
              return (
                <tr key={abbr}>
                  <td className="num pw-rank">{String(r.season_rank ?? "—")}</td>
                  <td>
                    <Link to={`/team/${abbr}`} className="team-cell">
                      <TeamLogo abbr={abbr} size={20} />{" "}{teamName(abbr)}
                    </Link>
                  </td>
                  {WEEKS.map((w) => {
                    const v = r[`w${w}`];
                    const num = typeof v === "number" ? v : null;
                    return (
                      <td key={w} className="num sos-cell" style={cellStyle(num)}>
                        {num === null ? <span className="sos-bye">{t("sos.bye")}</span>
                                      : num.toFixed(1)}
                      </td>
                    );
                  })}
                  <td className="num"><strong>{Number(r.season_sos ?? 0).toFixed(1)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="ag-foot">{t("sos.method")}</p>
    </section>
  );
}
