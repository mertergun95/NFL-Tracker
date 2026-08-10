/** Sekme içeriği seçili lige göre değişir (başlıktaki NFL/NCAA anahtarı). */
import { useLeague } from "../../src/lib/league";
import NflHome from "../../src/screens/nfl/Home";
import NcaaHome from "../../src/screens/ncaa/Home";

export default function HomeTab() {
  const { league } = useLeague();
  return league === "ncaa" ? <NcaaHome /> : <NflHome />;
}
