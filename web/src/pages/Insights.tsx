import { Link } from "react-router-dom";
import { Loading } from "../components/Pickers";
import { loadInsights, type Insight } from "../lib/data";
import { useAsync } from "../lib/hooks";

const SECTIONS: [string, string, string][] = [
  ["matchups", "Gelecek Hafta Matchup Notları", "Sıradaki haftanın maçları için geçmiş sezon verisine dayalı avantaj analizi."],
  ["scheme", "Şema Notları", "Blitze karşı QB profilleri ve blitz-ağır rakip eşleşmeleri (FTN charting)."],
  ["hot", "Formda Olanlar", "Son 3 haftası sezon ortalamasının belirgin üstünde."],
  ["cold", "Form Düşüşü", "Son 3 haftası sezon ortalamasının belirgin altında."],
  ["usage", "Kullanımı Artanlar", "Target/carry payı son haftalarda yükselenler."],
  ["team_power", "Takım Güç Profili", "EPA/play bazlı lig liderleri."],
];

function InsightCard({ item }: { item: Insight }) {
  return (
    <div className="insight-card">
      <h3>
        {item.player_id
          ? <Link to={`/player/${item.player_id}`}>{item.title}</Link>
          : item.team
            ? <Link to={`/team/${item.team}`}>{item.title}</Link>
            : item.title}
      </h3>
      <p>{item.detail}</p>
    </div>
  );
}

export default function Insights() {
  const { data, loading } = useAsync(() => loadInsights(), []);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">Insights henüz üretilmedi — Salı pipeline'ını bekleyin.</p>;

  return (
    <section>
      <h1>Key Insights</h1>
      <p className="sub">
        {data.data_season} sezonu, hafta 1–{data.through_week} verisiyle üretildi ·
        sıradaki maç haftası: {data.next_game_week.season} W{data.next_game_week.week} ·
        {" "}{data.generated_at.slice(0, 10)}
      </p>
      {SECTIONS.map(([key, title, desc]) => {
        const items = data.sections[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <h2>{title}</h2>
            <p className="sub">{desc}</p>
            <div className="insight-grid">
              {items.map((it, i) => <InsightCard key={i} item={it} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
