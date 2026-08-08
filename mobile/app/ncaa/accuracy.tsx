/** NCAA projeksiyon karnesi — NFL'dekiyle aynı okuma biçimi, farklı veri. */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import PName from "../../src/components/PName";
import NcaaBadge from "../../src/components/NcaaBadge";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader, StatTile, Title,
} from "../../src/components/ui";
import { loadNcaaProjEval } from "../../src/lib/ncaa";
import { useAsync, useRefresh } from "../../src/lib/hooks";
import { fmt, label } from "../../src/lib/columns";
import { useT } from "../../src/lib/i18n";
import { font, space, useColors } from "../../src/lib/theme";

const STAT_CHOICES = ["passing_yards", "rushing_yards", "receiving_yards",
                      "receptions", "carries", "completions", "attempts",
                      "passing_tds", "rushing_tds", "receiving_tds"];
const POS_OF_STAT: Record<string, string[]> = {
  passing_yards: ["QB"], passing_tds: ["QB"], completions: ["QB"], attempts: ["QB"],
  rushing_yards: ["RB", "QB"], carries: ["RB", "QB"], rushing_tds: ["RB", "QB"],
  receiving_yards: ["WR", "RB"], receptions: ["WR", "RB"], receiving_tds: ["WR"],
};

export default function NcaaAccuracy() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [stat, setStat] = useState("passing_yards");
  const [weekChoice, setWeekChoice] = useState<number | null>(null);

  const q = useAsync((o) => loadNcaaProjEval(o), []);
  const { refreshing, onRefresh } = useRefresh([q.reload]);
  const data = q.data;

  const statCols = useMemo(() => {
    const set = new Set<string>();
    for (const w of data?.weeks ?? []) for (const s of Object.keys(w.stats)) set.add(s);
    return STAT_CHOICES.filter((s) => set.has(s));
  }, [data]);

  const lastWeek = data?.weeks[data.weeks.length - 1]?.week ?? null;
  const activeWeek = weekChoice ?? lastWeek;

  const metrics = useMemo(
    () => data?.weeks.find((w) => w.week === activeWeek)?.stats[stat] ?? null,
    [data, activeWeek, stat],
  );

  const rows = useMemo(() => {
    const poss = POS_OF_STAT[stat] ?? [];
    return (data?.players ?? [])
      .filter((p) => Number(p.week) === activeWeek
        && poss.includes(String(p.position))
        && p[`proj_${stat}`] !== null && p[`proj_${stat}`] !== undefined
        && p[`act_${stat}`] !== null && p[`act_${stat}`] !== undefined)
      .sort((a, b) => Number(b[`act_${stat}`]) - Number(a[`act_${stat}`]))
      .slice(0, 40);
  }, [data, activeWeek, stat]);

  if (q.loading && !data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("acc.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="ncaa/proj_eval.json">
        {!data ? <Empty text={t("acc.notReady")} /> : (
          <>
            <Title sub={data.method}>{t("acc.title")}</Title>

            <PillRow
              options={(data.weeks ?? []).map((w) => ({
                value: w.week, label: `${t("common.weekShort")} ${w.week}`,
              }))}
              value={activeWeek ?? 0}
              onChange={setWeekChoice}
              compact
            />
            <PillRow
              options={statCols.map((s) => ({ value: s, label: label(s) }))}
              value={stat}
              onChange={setStat}
              compact
            />

            {metrics ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
                <StatTile label="MAE" value={metrics.mae.toFixed(1)} />
                <StatTile label="Bias" value={metrics.bias.toFixed(1)} />
                <StatTile label="Corr"
                          value={metrics.corr === null ? "—" : metrics.corr.toFixed(2)} />
                <StatTile label="n" value={String(metrics.n)} />
              </ScrollView>
            ) : null}

            <SectionHeader title={`${label(stat)} — ${t("common.week")} ${activeWeek}`} />
            <Muted style={{ marginBottom: space.sm }}>{t("acc.tableSub")}</Muted>

            {rows.map((p, i) => {
              const proj = Number(p[`proj_${stat}`]);
              const act = Number(p[`act_${stat}`]);
              const diff = proj - act;
              return (
                <Card
                  key={`${p.player_id}-${i}`}
                  style={{ marginBottom: space.sm }}
                  onPress={() => router.push(`/ncaa/player/${p.player_id}`)}
                >
                  <View style={styles.row}>
                    <NcaaBadge abbr={String(p.team)} size={24} />
                    <View style={{ flex: 1 }}>
                      <PName name={String(p.player_name)} pos={String(p.position ?? "")}
                             size={font.md} />
                      <Muted style={{ marginTop: 2 }}>vs {String(p.opponent ?? "—")}</Muted>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: c.textDim, fontSize: font.xs }}>
                        {t("common.projection")} {fmt(stat, proj)}
                      </Text>
                      <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                        {fmt(stat, act)}
                      </Text>
                      <Text style={{
                        color: Math.abs(diff) <= Math.max(15, act * 0.25) ? c.good : c.warn,
                        fontSize: font.xs, fontWeight: "600",
                      }}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}

            {rows.length === 0 ? <Empty text={t("table.empty")} /> : null}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
});
