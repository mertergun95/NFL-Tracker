/** Sekme içeriği seçili lige göre değişir (başlıktaki NFL/NCAA anahtarı). */
import { useLeague } from "../../src/lib/league";
import NflProjections from "../../src/screens/nfl/Projections";
import NcaaProjections from "../../src/screens/ncaa/Projections";

export default function ProjectionsTab() {
  const { league } = useLeague();
  return league === "ncaa" ? <NcaaProjections /> : <NflProjections />;
}
