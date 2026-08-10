/** NFL Agent: haftalık boom/bust çağrıları + bülten.
 *
 *  Sayfadaki bütün rakamlar pipeline/agent.py'nin hesapladığı sinyallerden
 *  gelir; model yalnızca bunları yorumlayan metni yazar. Ajanın çıktısı
 *  bilerek İngilizcedir (tek dilde tek anlatı), sayfa çerçevesi ise sitenin
 *  dilini kullanır.
 */
import { Link } from "react-router-dom";
import PName from "../components/PName";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import {
  loadAgent, type AgentPayload, type AgentPick, type AgentSignal,
} from "../lib/data";
import { useAsync } from "../lib/hooks";
import { useT } from "../lib/i18n";

function Signal({ s }: { s: AgentSignal }) {
  return (
    <li className={`ag-signal ag-${s.tone}`}>
      <span className="ag-signal-label">{s.label}</span>
      <span>{s.value}</span>
    </li>
  );
}

/** Son maçların PPR'ı — küçük bir kıyas şeridi. */
function RecentStrip({ pick }: { pick: AgentPick }) {
  const t = useT();
  const games = pick.recent_games.filter((g) => g.ppr !== null);
  if (games.length === 0) return null;
  const max = Math.max(...games.map((g) => g.ppr as number), 1);
  return (
    <div className="ag-strip">
      <span className="ag-strip-title">{t("agent.lastGames")}</span>
      {games.map((g) => (
        <div key={g.week} className="ag-strip-col"
             title={`${g.opponent ? `vs ${g.opponent} · ` : ""}${g.ppr} PPR`}>
          <span className="ag-strip-val">{g.ppr}</span>
          <div className="ag-strip-bar"
               style={{ height: `${Math.max(2, ((g.ppr as number) / max) * 28)}px` }} />
          <span>{t("common.weekShort")}{g.week}</span>
        </div>
      ))}
    </div>
  );
}

function PickCard({ pick }: { pick: AgentPick }) {
  const t = useT();
  return (
    <article className={`ag-card ag-${pick.kind}`}>
      <header>
        <span className={`ag-tag ag-tag-${pick.kind}`}>
          {t(pick.kind === "boom" ? "agent.boom" : "agent.bust")}
        </span>
        <span className={`ag-conf ag-conf-${pick.confidence}`}>
          {t(`agent.conf.${pick.confidence}`)}
        </span>
      </header>
      <h3>
        <TeamLogo abbr={pick.team} size={20} />
        <PName name={pick.player_name} pos={pick.position} id={pick.player_id} />
        <span className="ag-vs">
          {t("agent.vs")} <Link to={`/team/${pick.opponent}`}>{pick.opponent}</Link>
        </span>
      </h3>
      {pick.angle ? <p className="ag-angle">{pick.angle}</p> : null}
      <p className="ag-note">{pick.note}</p>
      <RecentStrip pick={pick} />
      <ul className="ag-signals">
        {pick.signals.map((s) => <Signal key={s.key} s={s} />)}
      </ul>
    </article>
  );
}

/** Geçmiş çağrıların karnesi: yalnızca sonucu belli olanlar sayılır. */
function Record({ data }: { data: AgentPayload }) {
  const t = useT();
  const { boom, bust } = data.record ?? {};
  if (!boom?.n && !bust?.n) return null;
  const pct = (r: { hits: number; n: number } | undefined) =>
    r && r.n ? `${Math.round((r.hits / r.n) * 100)}% (${r.hits}/${r.n})` : "—";
  const graded = data.history.filter((h) => h.picks.some((p) => p.hit !== undefined));
  return (
    <>
      <h2>{t("agent.record")}</h2>
      <p className="sub">{t("agent.recordSub", { n: data.record.weeks ?? 0 })}</p>
      <div className="tile-grid">
        <div className="tile">
          <div className="tile-label">{t("agent.boomHitRate")}</div>
          <div className="tile-value">{pct(boom)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">{t("agent.bustHitRate")}</div>
          <div className="tile-value">{pct(bust)}</div>
        </div>
      </div>
      {graded.slice(-3).reverse().map((week) => (
        <div key={`${week.season}-${week.week}`} className="ag-history">
          <h3>{week.season} · {t("common.week")} {week.week}</h3>
          <table className="stat-table">
            <thead>
              <tr>
                <th>{t("common.player")}</th>
                <th>{t("agent.call")}</th>
                <th className="num">{t("agent.projShort")}</th>
                <th className="num">{t("agent.bar")}</th>
                <th className="num">{t("agent.actual")}</th>
                <th>{t("agent.result")}</th>
              </tr>
            </thead>
            <tbody>
              {week.picks.filter((p) => p.hit !== undefined).map((p) => (
                <tr key={p.player_id}>
                  <td><PName name={p.player_name} pos={p.position} id={p.player_id} /></td>
                  <td>{t(p.kind === "boom" ? "agent.boom" : "agent.bust")}</td>
                  <td className="num">{p.proj_ppr ?? "—"}</td>
                  <td className="num">{p.bar ?? "—"}</td>
                  <td className="num">{p.actual_ppr ?? "—"}</td>
                  <td className={p.hit ? "ag-hit" : "ag-miss"}>
                    {t(p.hit ? "agent.hit" : "agent.miss")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default function Agent() {
  const t = useT();
  const { data, loading } = useAsync(() => loadAgent(), []);

  if (loading) return <Loading />;
  if (!data) return <p className="empty">{t("agent.notReady")}</p>;

  const boom = data.picks.filter((p) => p.kind === "boom");
  const bust = data.picks.filter((p) => p.kind === "bust");

  return (
    <section>
      <h1>{t("agent.title")}</h1>
      <p className="sub">
        {t("agent.sub", { season: data.target.season, week: data.target.week,
                          ds: data.data_season, dw: data.through_week })}
        {" "}{data.generated_at.slice(0, 10)}
      </p>

      <div className="ag-lead">
        <h2>{data.headline}</h2>
        <p>{data.overview}</p>
      </div>

      <h2>{t("agent.boomList")}</h2>
      <p className="sub">{t("agent.boomSub")}</p>
      <div className="ag-grid">{boom.map((p) => <PickCard key={p.player_id} pick={p} />)}</div>

      <h2>{t("agent.bustList")}</h2>
      <p className="sub">{t("agent.bustSub")}</p>
      <div className="ag-grid">{bust.map((p) => <PickCard key={p.player_id} pick={p} />)}</div>

      {data.sections.length > 0 ? (
        <>
          <h2>{t("agent.bulletin")}</h2>
          <div className="insight-grid">
            {data.sections.map((s) => (
              <div key={s.title} className="insight-card">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <Record data={data} />

      <p className="ag-foot">
        {t("agent.method")}
        {data.engine === "rules" ? ` ${t("agent.rulesOnly")}` : ""}
      </p>
    </section>
  );
}
