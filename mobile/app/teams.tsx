/** Takım istatistikleri — kategori seçimli tek tablo.
 *  Web'deki Teams sayfasının kategori setleri korunur; scatter grafik
 *  telefonda okunmadığı için buraya alınmadı. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import StatTable from "../src/components/StatTable";
import { TeamCell } from "../src/components/TeamBadge";
import {
  ErrorBox, Loading, PillRow, SearchBar, Title,
} from "../src/components/ui";
import {
  loadManifest, loadTeamAdvanced, loadTeamSeason, seasonsFromManifest,
} from "../src/lib/data";
import { useAsync, useDebounced, useRefresh } from "../src/lib/hooks";
import { teamName } from "../src/lib/teams";
import { useT } from "../src/lib/i18n";
import { space } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const CATEGORIES: { key: string; labelKey: string; cols: string[] }[] = [
  { key: "summary", labelKey: "cat.summary", cols: [
    "team", "wins", "losses", "points_for", "points_against",
    "off_epa_play", "def_epa_play", "passing_yards", "rushing_yards"] },
  { key: "offense", labelKey: "cat.offense", cols: [
    "team", "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "carries", "rushing_yards",
    "rushing_tds", "off_epa_play", "off_pass_epa", "off_rush_epa",
    "off_success_rate", "off_explosive_rate", "off_third_down_conv"] },
  { key: "defense", labelKey: "cat.defense", cols: [
    "team", "points_against", "def_sacks", "def_interceptions",
    "def_epa_play", "def_pass_epa", "def_rush_epa", "def_success_rate",
    "def_explosive_rate", "def_third_down_conv", "def_rz_td_pct"] },
];

export default function Teams() {
  const t = useT();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [cat, setCat] = useState("summary");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamQ = useAsync(
    (o) => (active ? loadTeamSeason(active, o) : Promise.resolve([])), [active]);
  const advQ = useAsync(
    (o) => (active ? loadTeamAdvanced(active, o) : Promise.resolve(null)), [active]);
  const { refreshing, onRefresh } = useRefresh([teamQ.reload, advQ.reload]);

  /** Sezon toplamları ile advanced satırları takım bazında birleştirilir. */
  const merged = useMemo(() => {
    const adv = new Map((advQ.data ?? []).map((r) => [String(r.team), r]));
    const rows: StatRow[] = (teamQ.data ?? []).map((r) => ({
      ...r, ...(adv.get(String(r.team)) ?? {}),
    }));
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.team ?? "").toLowerCase().includes(q)
      || teamName(String(r.team)).toLowerCase().includes(q));
  }, [teamQ.data, advQ.data, query]);

  const columns = CATEGORIES.find((c) => c.key === cat)!.cols;

  return (
    <>
      <Stack.Screen options={{ title: t("teams.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `seasons/${active}/team_season.json` : undefined}>
        <Title sub={t("teams.sub")}>{t("teams.title")}</Title>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />
        <PillRow
          options={CATEGORIES.map((c) => ({ value: c.key, label: t(c.labelKey) }))}
          value={cat}
          onChange={setCat}
          compact
        />
        <View style={{ height: space.sm }} />
        <SearchBar value={search} onChange={setSearch}
                   placeholder={t("common.searchTeam")} />

        {teamQ.loading && !teamQ.data ? <Loading /> : null}
        {teamQ.error && !teamQ.data ? (
          <ErrorBox msg={teamQ.error} onRetry={() => teamQ.reload(true)} />
        ) : null}

        {teamQ.data ? (
          <View style={{ marginTop: space.md }}>
            <StatTable
              rows={merged}
              columns={columns}
              defaultSort={cat === "defense" ? "def_epa_play" : "points_for"}
              onRowPress={(row) => router.push(`/team/${row.team}`)}
              render={{ team: (row) => <TeamCell abbr={row.team as string} size={20} /> }}
              firstWidth={96}
            />
          </View>
        ) : null}
      </Screen>
    </>
  );
}
