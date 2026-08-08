/** Sekme içeriği seçili lige göre değişir (başlıktaki NFL/NCAA anahtarı). */
import { useLeague } from "../../src/lib/league";
import NflMore from "../../src/screens/nfl/More";
import NcaaMore from "../../src/screens/ncaa/More";

export default function MoreTab() {
  const { league } = useLeague();
  return league === "ncaa" ? <NcaaMore /> : <NflMore />;
}
