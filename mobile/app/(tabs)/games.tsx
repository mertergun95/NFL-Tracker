/** Sekme içeriği seçili lige göre değişir (başlıktaki NFL/NCAA anahtarı). */
import { useLeague } from "../../src/lib/league";
import NflGames from "../../src/screens/nfl/Games";
import NcaaGames from "../../src/screens/ncaa/Games";

export default function GamesTab() {
  const { league } = useLeague();
  return league === "ncaa" ? <NcaaGames /> : <NflGames />;
}
