import { Link } from "react-router-dom";
import { Loading } from "../components/Pickers";
import { loadInsights, type Insight } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { localized, useI18n, useT } from "../lib/i18n";

const SECTIONS: [string, string, string][] = [
  ["matchups", "insights.matchups", "insights.matchupsSub"],
  ["scheme", "insights.scheme", "insights.schemeSub"],
  ["hot", "insights.hot", "insights.hotSub"],
  ["cold", "insights.cold", "insights.coldSub"],
  ["usage", "insights.usage", "insights.usageSub"],
  ["team_power", "insights.teamPower", "insights.teamPowerSub"],
];

function InsightCard({ item }: { item: Insight }) {
  const { lang } = useI18n();
  const title = localized(item.title, lang);
  return (
    <div className="insight-card">
      <h3>
        {item.player_id
          ? <Link to={`/player/${item.player_id}`}>{title}</Link>
          : item.team
            ? <Link to={`/team/${item.team}`}>{title}</Link>
            : title}
      </h3>
      <p>{localized(item.detail, lang)}</p>
    </div>
  );
}

export default function Insights() {
  const t = useT();
  const { data, loading } = useAsync(() => loadInsights(), []);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">{t("insights.notReady")}</p>;

  return (
    <section>
      <h1>{t("insights.title")}</h1>
      <p className="sub">
        {t("insights.sub", { season: data.data_season, week: data.through_week,
                             ns: data.next_game_week.season,
                             nw: data.next_game_week.week })}
        {" "}{data.generated_at.slice(0, 10)}
      </p>
      {SECTIONS.map(([key, title, desc]) => {
        const items = data.sections[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <h2>{t(title)}</h2>
            <p className="sub">{t(desc)}</p>
            <div className="insight-grid">
              {items.map((it, i) => <InsightCard key={i} item={it} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
