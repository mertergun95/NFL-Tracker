/** Oyuncular — sezon toplamları, pozisyon sekmeleri ve arama.
 *  Web'deki Players sayfasıyla aynı veri ve aynı kolon ön ayarları. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import StatTable from "../../components/StatTable";
import PName from "../../components/PName";
import { TeamCell } from "../../components/TeamBadge";
import {
  ErrorBox, Loading, Muted, PillRow, SearchBar, Title,
} from "../../components/ui";
import { loadManifest, loadPlayerSeason, seasonsFromManifest } from "../../lib/data";
import { useAsync, useDebounced, useRefresh } from "../../lib/hooks";
import { POSITION_PRESETS } from "../../lib/columns";
import { useT } from "../../lib/i18n";
import { space } from "../../lib/theme";
import type { StatRow } from "../../lib/types";

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
  K: (p) => p.position === "K",
  DEF: (p) => !["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(String(p.position ?? "")),
};

const DEFAULT_SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
  TE: "receiving_yards", K: "fg_made", DEF: "def_sacks",
};

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export default function Players() {
  const t = useT();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [pos, setPos] = useState("QB");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const playersQ = useAsync(
    (o) => (active ? loadPlayerSeason(active, o) : Promise.resolve([])), [active]);
  const { refreshing, onRefresh } = useRefresh([manifestQ.reload, playersQ.reload]);

  const rows = useMemo(() => {
    if (!playersQ.data) return [];
    let r = playersQ.data.filter(POS_FILTER[pos]);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((p) =>
        String(p.player_name ?? "").toLowerCase().includes(q)
        || String(p.team ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [playersQ.data, pos, query]);

  const columns = ["player_name", "team", "games", ...POSITION_PRESETS[pos]];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey={active ? `seasons/${active}/player_season.json` : undefined}>
      <Title sub={t("players.sub")}>{t("players.title")}</Title>

      <PillRow
        options={seasons.map((s) => ({ value: s, label: String(s) }))}
        value={active ?? 0}
        onChange={setSeason}
      />
      <PillRow
        options={POSITIONS.map((p) => ({ value: p, label: p }))}
        value={pos}
        onChange={setPos}
        compact
      />
      <View style={{ height: space.sm }} />
      <SearchBar value={search} onChange={setSearch}
                 placeholder={t("common.searchPlayer")} />

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
            columns={columns}
            defaultSort={DEFAULT_SORT[pos]}
            onRowPress={(row) => router.push(`/player/${row.player_id}`)}
            render={{
              player_name: (row) => (
                <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                       id={String(row.player_id)} />
              ),
              team: (row) => <TeamCell abbr={row.team as string} size={18} />,
            }}
            firstWidth={150}
          />
        </>
      ) : null}
    </Screen>
  );
}
