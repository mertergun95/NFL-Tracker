/** NCAA puan durumu — konferans konferans W-L (bowl/playoff dahil). */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import NcaaBadge from "../../src/components/NcaaBadge";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, SectionHeader, Title,
} from "../../src/components/ui";
import {
  loadNcaaManifest, loadNcaaTeams, loadNcaaTeamSeason, teamMapOf,
} from "../../src/lib/ncaa";
import { seasonsFromManifest } from "../../src/lib/data";
import { useAsync, useRefresh } from "../../src/lib/hooks";
import { useT } from "../../src/lib/i18n";
import { font, space, useColors } from "../../src/lib/theme";
import type { StatRow } from "../../src/lib/types";

export default function NcaaStandings() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamSeasonQ = useAsync(
    (o) => (active ? loadNcaaTeamSeason(active, o) : Promise.resolve([])), [active]);
  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);
  const { refreshing, onRefresh } = useRefresh([teamSeasonQ.reload, teamsQ.reload]);

  /** Konferansa göre grupla; konferansı olmayanlar "Diğer" altında. */
  const groups = useMemo(() => {
    const map = new Map<string, StatRow[]>();
    for (const r of teamSeasonQ.data ?? []) {
      const key = r.conference ? String(r.conference) : t("ncaa.other");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()]
      .map(([conf, rows]) => ({
        conf,
        rows: rows.sort((a, b) => {
          const cw = Number(b.conf_wins ?? 0) - Number(a.conf_wins ?? 0);
          if (cw !== 0) return cw;
          return Number(b.wins ?? 0) - Number(a.wins ?? 0);
        }),
      }))
      .sort((a, b) => a.conf.localeCompare(b.conf));
  }, [teamSeasonQ.data, t]);

  if (!manifestQ.loading && !manifestQ.data)
    return <Screen><Empty text={t("ncaa.notReadyGeneric")} /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("ncaa.standingsTitle") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `ncaa/seasons/${active}/team_season.json` : undefined}>
        <Title sub={t("ncaa.standingsSub")}>{t("ncaa.standingsTitle")}</Title>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />

        {teamSeasonQ.loading && !teamSeasonQ.data ? <Loading /> : null}
        {teamSeasonQ.error && !teamSeasonQ.data ? (
          <ErrorBox msg={teamSeasonQ.error} onRetry={() => teamSeasonQ.reload(true)} />
        ) : null}

        {groups.map(({ conf, rows }) => (
          <View key={conf}>
            <SectionHeader title={conf} />
            {rows.map((r) => (
              <Card
                key={String(r.team)}
                style={styles.row}
                onPress={() => router.push(`/ncaa/team/${r.team}`)}
              >
                <NcaaBadge abbr={String(r.team)} size={24} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1}
                        style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                    {tmap.get(String(r.team))?.school ?? String(r.team)}
                  </Text>
                  <Muted>
                    {t("ncaa.perGame", {
                      pf: String(r.points_pg ?? "—"),
                      pa: String(r.points_allowed_pg ?? "—"),
                    })}
                  </Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
                    {r.wins ?? 0}-{r.losses ?? 0}
                  </Text>
                  <Text style={{ color: c.textDim, fontSize: font.xs }}>
                    {t("ncaa.confShort")} {r.conf_wins ?? 0}-{r.conf_losses ?? 0}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ))}

        {!teamSeasonQ.loading && groups.length === 0 ? (
          <Empty text={t("table.empty")} />
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    marginBottom: 6, paddingVertical: space.sm,
  },
});
