/** Sekme içeriği seçili lige göre değişir (başlıktaki NFL/NCAA anahtarı). */
import { useLeague } from "../../src/lib/league";
import NflPlayers from "../../src/screens/nfl/Players";
import NcaaPlayers from "../../src/screens/ncaa/Players";

export default function PlayersTab() {
  const { league } = useLeague();
  return league === "ncaa" ? <NcaaPlayers /> : <NflPlayers />;
}
