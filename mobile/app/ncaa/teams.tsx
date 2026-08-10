/** NCAA takım istatistikleri — maç başına değerler, konferans filtresi. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import StatTable from "../../src/components/StatTable";
import { NcaaTeamCell } from "../../src/components/NcaaBadge";
import {
  Empty, ErrorBox, Loading, Muted, PillRow, SearchBar, Title,
} from "../../src/components/ui";
import {
  loadNcaaManifest, loadNcaaTeams, loadNcaaTeamSeason, teamMapOf,
} from "../../src/lib/ncaa";
import { seasonsFromManifest } from "../../src/lib/data";
import { useAsync, useDebounced, useRefresh } from "../../src/lib/hooks";
import { useT } from "../../src/lib/i18n";
import { space } from "../../src/lib/theme";

const COLS = ["team", "wins", "losses", "points_pg", "points_allowed_pg",
              "total_yards_pg", "passing_yards_pg", "rushing_yards_pg",
              "turnovers_pg", "third_down_pct_pg"];

const ALL = "ALL";

export default function NcaaTeams() {
  const t = useT();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [conf, setConf] = useState(ALL);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamSeasonQ = useAsync(
    (o) => (active ? loadNcaaTeamSeason(active, o) : Promise.resolve([])), [active]);
  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);
  const { refreshing, onRefresh } = useRefresh([teamSeasonQ.reload, teamsQ.reload]);

  const conferences = useMemo(() => {
    const set = new Set<string>();
    for (const r of teamSeasonQ.data ?? [])
      if (r.conference) set.add(String(r.conference));
    return [ALL, ...[...set].sort()];
  }, [teamSeasonQ.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teamSeasonQ.data ?? [])
      .filter((r) => conf === ALL || r.conference === conf)
      .filter((r) => !q
        || String(r.team ?? "").toLowerCase().includes(q)
        || (tmap.get(String(r.team))?.school ?? "").toLowerCase().includes(q)
        || String(r.conference ?? "").toLowerCase().includes(q));
  }, [teamSeasonQ.data, conf, query, tmap]);

  if (!manifestQ.loading && !manifestQ.data)
    return <Screen><Empty text={t("ncaa.notReadyGeneric")} /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("ncaa.teamsTitle") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `ncaa/seasons/${active}/team_season.json` : undefined}>
        <Title sub={t("teams.sub")}>{t("ncaa.teamsTitle")}</Title>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />
        <PillRow
          options={conferences.map((cf) => ({
            value: cf, label: cf === ALL ? t("common.all") : cf,
          }))}
          value={conf}
          onChange={setConf}
          compact
        />
        <View style={{ height: space.sm }} />
        <SearchBar value={search} onChange={setSearch}
                   placeholder={t("ncaa.searchSchool")} />

        {teamSeasonQ.loading && !teamSeasonQ.data ? <Loading /> : null}
        {teamSeasonQ.error && !teamSeasonQ.data ? (
          <ErrorBox msg={teamSeasonQ.error} onRetry={() => teamSeasonQ.reload(true)} />
        ) : null}

        {teamSeasonQ.data ? (
          <>
            <Muted style={{ marginTop: space.md, marginBottom: space.sm }}>
              {t("m.results", { n: rows.length })}
            </Muted>
            <StatTable
              rows={rows}
              columns={COLS}
              defaultSort="points_pg"
              onRowPress={(row) => router.push(`/ncaa/team/${row.team}`)}
              render={{ team: (row) => <NcaaTeamCell abbr={row.team as string} size={20} /> }}
              firstWidth={108}
            />
          </>
        ) : null}
      </Screen>
    </>
  );
}
