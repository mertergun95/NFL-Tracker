/** NCAA oyuncuları — sezon toplamları.
 *  Pozisyonlar ESPN'de yok; pipeline box score hacminden türetiyor
 *  (pasçı QB, koşucu RB, kalanı WR), bu yüzden sadece üç sekme var. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import StatTable from "../../components/StatTable";
import PName from "../../components/PName";
import { NcaaTeamCell } from "../../components/NcaaBadge";
import {
  Empty, ErrorBox, Loading, Muted, PillRow, SearchBar, Title,
} from "../../components/ui";
import {
  loadNcaaManifest, loadNcaaPlayerSeason, NCAA_POSITIONS, ncaaPreset,
} from "../../lib/ncaa";
import { seasonsFromManifest } from "../../lib/data";
import { useAsync, useDebounced, useRefresh } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { space } from "../../lib/theme";

const SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
};

export default function NcaaPlayers() {
  const t = useT();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [pos, setPos] = useState("QB");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const playersQ = useAsync(
    (o) => (active ? loadNcaaPlayerSeason(active, o) : Promise.resolve([])), [active]);
  const { refreshing, onRefresh } = useRefresh([manifestQ.reload, playersQ.reload]);

  const rows = useMemo(() => {
    if (!playersQ.data) return [];
    let r = playersQ.data.filter((p) => p.position === pos);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((p) =>
        String(p.player_name ?? "").toLowerCase().includes(q)
        || String(p.team ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [playersQ.data, pos, query]);

  if (!manifestQ.loading && !manifestQ.data)
    return <Screen><Empty text={t("ncaa.notReadyGeneric")} /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey={active ? `ncaa/seasons/${active}/player_season.json` : undefined}>
      <Title sub={t("ncaa.playersSub")}>{t("ncaa.playersTitle")}</Title>

      <PillRow
        options={seasons.map((s) => ({ value: s, label: String(s) }))}
        value={active ?? 0}
        onChange={setSeason}
      />
      <PillRow
        options={NCAA_POSITIONS.map((p) => ({ value: p, label: p }))}
        value={pos}
        onChange={setPos}
        compact
      />
      <View style={{ height: space.sm }} />
      <SearchBar value={search} onChange={setSearch}
                 placeholder={t("ncaa.searchPlayerTeam")} />

      {playersQ.loading && !playersQ.data ? <Loading /> : null}
      {playersQ.error && !playersQ.data ? (
        <ErrorBox msg={playersQ.error} onRetry={() => playersQ.reload(true)} />
      ) : null}

      {playersQ.data ? (
        <>
          <Muted style={{ marginTop: space.md, marginBottom: space.sm }}>
            {t("m.results", { n: rows.length })}
          </Muted>
          <StatTable
            rows={rows}
            columns={["player_name", "team", "games", ...ncaaPreset(pos)]}
            defaultSort={SORT[pos]}
            onRowPress={(row) => router.push(`/ncaa/player/${row.player_id}`)}
            render={{
              player_name: (row) => (
                <PName name={String(row.player_name)} pos={String(row.position ?? "")} />
              ),
              team: (row) => <NcaaTeamCell abbr={row.team as string} size={18}
                                           showAbbr={false} />,
            }}
            firstWidth={150}
          />
        </>
      ) : null}
    </Screen>
  );
}
