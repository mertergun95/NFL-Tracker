/** NCAA kadroları — 250+ okul olduğu için takım seçimi aranabilir bir
 *  listeden yapılıyor (NFL'deki 32 rozetlik şerit burada işe yaramaz). */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import NcaaBadge from "../../src/components/NcaaBadge";
import {
  Card, Empty, Loading, Muted, SearchBar, SectionHeader, Title,
} from "../../src/components/ui";
import { loadNcaaRosters, loadNcaaTeams, teamMapOf } from "../../src/lib/ncaa";
import { useAsync, useDebounced, useRefresh } from "../../src/lib/hooks";
import { useT } from "../../src/lib/i18n";
import { font, space, useColors } from "../../src/lib/theme";
import type { StatRow } from "../../src/lib/types";

const UNIT_KEYS: Record<string, string> = {
  offense: "unit.offense", defense: "unit.defense", specialTeam: "unit.st",
};
const POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "OT", "G", "C", "OL",
                   "DE", "DT", "DL", "EDGE", "LB", "CB", "S", "DB",
                   "PK", "P", "LS", "ATH"];

export default function NcaaRosters() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [team, setTeam] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const rostersQ = useAsync((o) => loadNcaaRosters(o), []);
  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);
  const { refreshing, onRefresh } = useRefresh([rostersQ.reload, teamsQ.reload]);

  const teamList = useMemo(() => {
    const set = new Set((rostersQ.data ?? []).map((r) => String(r.team)));
    return [...set].sort((a, b) =>
      (tmap.get(a)?.school ?? a).localeCompare(tmap.get(b)?.school ?? b));
  }, [rostersQ.data, tmap]);

  /** Takım seçilmemişken arama okul listesinde, seçiliyken kadroda çalışır. */
  const teamMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teamList.slice(0, 40);
    return teamList
      .filter((abbr) => abbr.toLowerCase().includes(q)
        || (tmap.get(abbr)?.school ?? "").toLowerCase().includes(q))
      .slice(0, 40);
  }, [teamList, query, tmap]);

  const byUnit = useMemo(() => {
    if (!team) return [];
    const rows = (rostersQ.data ?? []).filter((r) => String(r.team) === team);
    const units = new Map<string, StatRow[]>();
    for (const r of rows) {
      const u = String(r.unit ?? "offense");
      if (!units.has(u)) units.set(u, []);
      units.get(u)!.push(r);
    }
    for (const list of units.values())
      list.sort((a, b) =>
        POS_ORDER.indexOf(String(a.position)) - POS_ORDER.indexOf(String(b.position))
        || String(a.player_name).localeCompare(String(b.player_name)));
    return [...units.entries()].sort(
      (a, b) => Object.keys(UNIT_KEYS).indexOf(a[0]) - Object.keys(UNIT_KEYS).indexOf(b[0]));
  }, [rostersQ.data, team]);

  if (rostersQ.loading && !rostersQ.data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("ncaa.rostersTitle") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="ncaa/rosters.json">
        {!rostersQ.data ? <Empty text={t("ncaa.rostersNotReady")} /> : (
          <>
            <Title sub={t("ncaa.rostersSub")}>{t("ncaa.rostersTitle")}</Title>

            {team ? (
              <Card style={styles.selected} onPress={() => setTeam(null)}>
                <NcaaBadge abbr={team} size={32} link />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                    {tmap.get(team)?.school ?? team}
                  </Text>
                  <Muted>{tmap.get(team)?.conference ?? ""}</Muted>
                </View>
                <Text style={{ color: c.link, fontSize: font.sm }}>✕</Text>
              </Card>
            ) : (
              <>
                <SearchBar value={search} onChange={setSearch}
                           placeholder={t("ncaa.searchSchool")} />
                <Muted style={{ marginTop: space.md, marginBottom: space.sm }}>
                  {t("m.results", { n: teamMatches.length })}
                </Muted>
                {teamMatches.map((abbr) => (
                  <Card
                    key={abbr}
                    style={styles.teamRow}
                    onPress={() => { setTeam(abbr); setSearch(""); }}
                  >
                    <NcaaBadge abbr={abbr} size={26} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1}
                            style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                        {tmap.get(abbr)?.school ?? abbr}
                      </Text>
                      <Muted>{tmap.get(abbr)?.conference ?? abbr}</Muted>
                    </View>
                    <Text style={{ color: c.textDim, fontSize: font.lg }}>›</Text>
                  </Card>
                ))}
              </>
            )}

            {byUnit.map(([unit, rows]) => (
              <View key={unit}>
                <SectionHeader title={`${t(UNIT_KEYS[unit] ?? unit)} (${rows.length})`} />
                {rows.map((r, i) => (
                  <Pressable
                    key={`${r.player_id}-${i}`}
                    onPress={() => router.push(`/ncaa/player/${r.player_id}`)}
                    style={[styles.playerRow, { borderBottomColor: c.border }]}
                  >
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 28 }}>
                      {r.jersey !== null && r.jersey !== undefined ? `#${r.jersey}` : ""}
                    </Text>
                    <Text numberOfLines={1}
                          style={{ color: c.link, fontSize: font.sm, flex: 1 }}>
                      {String(r.player_name)}
                    </Text>
                    <Text style={{ color: c.text, fontSize: font.xs, width: 42 }}>
                      {String(r.position ?? "")}
                    </Text>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 52,
                                   textAlign: "right" }}>
                      {String(r.class ?? "")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: "row", alignItems: "center", gap: space.md },
  teamRow: {
    flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: 6,
  },
  playerRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
