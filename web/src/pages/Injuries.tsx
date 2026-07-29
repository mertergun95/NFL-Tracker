import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import { loadInjuries } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS, teamName } from "../lib/teams";
import { useT } from "../lib/i18n";

const STATUS_ORDER: Record<string, number> = { Out: 0, Doubtful: 1, Questionable: 2 };

export default function Injuries() {
  const t = useT();
  const [team, setTeam] = useState<string | null>(null);
  const { data, loading } = useAsync(() => loadInjuries(), []);

  const latest = useMemo(() => {
    if (!data || data.length === 0) return null;
    const maxWeek = Math.max(...data.map((r) => Number(r.week ?? 0)));
    const rows = data
      .filter((r) => Number(r.week ?? 0) === maxWeek && r.report_status)
      .sort((a, b) =>
        (STATUS_ORDER[String(a.report_status)] ?? 9)
        - (STATUS_ORDER[String(b.report_status)] ?? 9));
    return { week: maxWeek, season: rows[0]?.season, rows };
  }, [data]);

  const filtered = useMemo(
    () => (latest?.rows ?? []).filter((r) => !team || r.team === team),
    [latest, team]);

  if (loading) return <Loading />;
  if (!latest)
    return <p className="empty">{t("inj.notReady")}</p>;

  return (
    <section>
      <h1>{t("inj.title")}</h1>
      <p className="sub">
        {t("inj.sub", { season: String(latest.season), week: String(latest.week) })}
      </p>
      <div className="logo-grid">
        <button className={`logo-btn ${team === null ? "active" : ""}`}
                onClick={() => setTeam(null)}
                style={{ padding: "8px 10px", color: "var(--text)" }}>
          {t("common.all")}
        </button>
        {Object.keys(TEAMS).map((t) => (
          <button key={t} className={`logo-btn ${t === team ? "active" : ""}`}
                  title={teamName(t)} onClick={() => setTeam(t)}>
            <TeamLogo abbr={t} size={30} />
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>{t("common.player")}</th><th>{t("common.position")}</th>
              <th>{t("common.team")}</th><th>{t("inj.status")}</th>
              <th>{t("inj.injury")}</th><th>{t("inj.practice")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>
                  <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                         id={r.player_id ? String(r.player_id) : undefined} />
                </td>
                <td>{String(r.position ?? "—")}</td>
                <td>
                  <Link to={`/team/${r.team}`} className="team-cell">
                    <TeamLogo abbr={String(r.team)} size={18} /> {String(r.team)}
                  </Link>
                </td>
                <td><StatusBadge status={String(r.report_status)} /></td>
                <td>{String(r.report_primary_injury ?? "—")}</td>
                <td>{String(r.practice_status ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="empty">{t("inj.none")}</p>}
    </section>
  );
}
