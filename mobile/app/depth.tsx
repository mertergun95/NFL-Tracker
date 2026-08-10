/** Derinlik listesi — takım seçip birim (hücum/savunma/özel) bazında
 *  pozisyon pozisyon sıralama. */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge, { TeamStrip } from "../src/components/TeamBadge";
import PName from "../src/components/PName";
import {
  Card, Empty, Loading, Muted, PillRow, Title,
} from "../src/components/ui";
import { loadDepthCharts } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { teamName } from "../src/lib/teams";
import { useT } from "../src/lib/i18n";
import { font, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const UNITS: [string, string][] = [
  ["offense", "unit.offense"],
  ["defense", "unit.defense"],
  ["st", "unit.st"],
];

/** formation etiketi ("3WR 1TE", "Base 3-4 D", "Special Teams") -> birim */
function unitOf(formation: string): string {
  const f = formation.toLowerCase();
  if (f.includes("special")) return "st";
  if (f.includes("base") || /\bd$/.test(f) || f.includes("defen")) return "defense";
  return "offense";
}

const POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT",
  "DE", "DT", "NT", "EDGE", "OLB", "ILB", "MLB", "LB", "CB", "NB", "SS", "FS", "S",
  "K", "P", "LS", "KR", "PR", "H"];

export default function DepthCharts() {
  const t = useT();
  const c = useColors();
  const [team, setTeam] = useState("KC");
  const [unit, setUnit] = useState("offense");

  const q = useAsync((o) => loadDepthCharts(o), []);
  const { refreshing, onRefresh } = useRefresh([q.reload]);
  const season = q.data?.[0]?.season;

  const groups = useMemo(() => {
    if (!q.data) return [];
    const rows = q.data.filter((r) => r.team === team
      && unitOf(String(r.formation ?? "")) === unit);
    const byPos = new Map<string, StatRow[]>();
    for (const r of rows) {
      const pos = String(r.position ?? "?");
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push(r);
    }
    return [...byPos.entries()]
      .map(([pos, players]) => ({
        pos,
        players: players.sort((a, b) => Number(a.depth) - Number(b.depth)),
      }))
      .sort((a, b) => {
        const ia = POS_ORDER.indexOf(a.pos), ib = POS_ORDER.indexOf(b.pos);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
  }, [q.data, team, unit]);

  if (q.loading && !q.data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("m.depth") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="depth_charts.json">
        {!q.data ? <Empty text={t("depth.notReady")} /> : (
          <>
            <Title sub={t("depth.sub")}>
              {t("depth.title", { season: season ? ` (${season})` : "" })}
            </Title>

            <TeamStrip value={team} onChange={(a) => a && setTeam(a)} />

            <View style={styles.teamHead}>
              <TeamBadge abbr={team} size={30} link />
              <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "700" }}>
                {teamName(team)}
              </Text>
            </View>

            <PillRow
              options={UNITS.map(([key, lbl]) => ({ value: key, label: t(lbl) }))}
              value={unit}
              onChange={setUnit}
              compact
            />

            <View style={{ marginTop: space.md }}>
              {groups.map(({ pos, players }) => (
                <Card key={pos} style={{ marginBottom: space.sm }}>
                  <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "800",
                                 marginBottom: space.sm }}>
                    {pos}
                  </Text>
                  {players.map((p, i) => (
                    <View key={`${p.player_id}-${i}`} style={styles.row}>
                      <Text style={{
                        color: Number(p.depth) === 1 ? c.accent : c.textDim,
                        fontSize: font.xs, fontWeight: "700", width: 16,
                      }}>
                        {String(p.depth)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <PName name={String(p.player_name)}
                               pos={String(p.position_slot ?? "")}
                               id={p.player_id ? String(p.player_id) : undefined} />
                      </View>
                      {p.jersey !== null && p.jersey !== undefined ? (
                        <Muted>#{String(p.jersey)}</Muted>
                      ) : null}
                    </View>
                  ))}
                </Card>
              ))}
            </View>

            {groups.length === 0 ? <Empty text={t("depth.emptyUnit")} /> : null}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  teamHead: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    marginTop: space.sm, marginBottom: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 5 },
});
