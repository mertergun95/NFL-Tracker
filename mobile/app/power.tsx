/** Güç sıralaması — hücum/savunma ayrı, NFL ve NCAA aynı ekran.
 *
 *  Reyting "lig ortalamasına göre maç başına puan": +6.0 hücum, ortalama bir
 *  savunmaya karşı lig ortalamasından 6 puan fazla atmak demek. Savunmada da
 *  + iyi. Rakibe göre düzeltilmiş, son maçlar daha ağır basıyor.
 */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge from "../src/components/TeamBadge";
import NcaaBadge from "../src/components/NcaaBadge";
import { Card, Empty, Loading, Muted, PillRow, Title } from "../src/components/ui";
import { loadNcaaPower, loadPower } from "../src/lib/data";
import { useLeague } from "../src/lib/league";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

type Side = "overall" | "off" | "def";
const RANK: Record<Side, string> = {
  overall: "overall_rank", off: "off_rank", def: "def_rank",
};
const RATING: Record<Side, string> = {
  overall: "overall_rating", off: "off_rating", def: "def_rating",
};

export default function PowerScreen() {
  const t = useT();
  const c = useColors();
  const { league } = useLeague();
  const ncaa = league === "ncaa";
  const [side, setSide] = useState<Side>("overall");

  const q = useAsync((o) => (ncaa ? loadNcaaPower(o) : loadPower(o)), [ncaa]);
  const { refreshing, onRefresh } = useRefresh([q.reload]);

  const rows = useMemo(() => {
    const col = RANK[side];
    return [...(q.data ?? [])].sort(
      (a, b) => Number(a[col] ?? 999) - Number(b[col] ?? 999));
  }, [q.data, side]);

  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(Number(r[RATING[side]] ?? 0)))),
    [rows, side]);

  if (q.loading && !q.data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("power.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={ncaa ? "ncaa/power.json" : "power.json"}>
        {rows.length === 0 ? <Empty text={t("power.notReady")} /> : (
          <>
            <Title sub={t("power.sub")}>{t("power.title")}</Title>
            <PillRow
              options={(["overall", "off", "def"] as Side[])
                .map((s) => ({ value: s, label: t(`power.${s}`) }))}
              value={side}
              onChange={setSide}
            />
            <View style={{ height: space.sm }} />

            {rows.slice(0, 60).map((r: StatRow) => {
              const abbr = String(r.team);
              const rating = Number(r[RATING[side]] ?? 0);
              const pct = Math.min(100, (Math.abs(rating) / max) * 100);
              return (
                <Card key={abbr} style={{ marginBottom: space.xs }}>
                  <View style={styles.row}>
                    <Text style={[styles.rank, { color: c.textDim }]}>
                      {String(r[RANK[side]] ?? "—")}
                    </Text>
                    {ncaa ? <NcaaBadge abbr={abbr} size={24} />
                          : <TeamBadge abbr={abbr} size={24} link />}
                    <Text style={{ color: c.text, fontSize: font.sm,
                                   fontWeight: "600", width: 46 }}>
                      {abbr}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.track, { backgroundColor: c.bgRaised }]}>
                        <View style={{
                          height: 6, borderRadius: 3, width: `${pct}%`,
                          backgroundColor: rating >= 0 ? c.good : c.bad,
                          alignSelf: rating >= 0 ? "flex-start" : "flex-end",
                        }} />
                      </View>
                    </View>
                    <Text style={{ color: rating >= 0 ? c.good : c.bad,
                                   fontSize: font.sm, fontWeight: "700",
                                   width: 52, textAlign: "right" }}>
                      {rating > 0 ? `+${rating.toFixed(1)}` : rating.toFixed(1)}
                    </Text>
                  </View>
                  <Muted style={{ marginTop: 4, fontSize: font.xs }}>
                    {t("power.off")} #{String(r.off_rank ?? "—")} ·{" "}
                    {t("power.def")} #{String(r.def_rank ?? "—")} ·{" "}
                    {t("power.ppg")} {String(r.ppg ?? "—")} ·{" "}
                    {t("power.papg")} {String(r.papg ?? "—")}
                  </Muted>
                </Card>
              );
            })}

            <Muted style={{ marginTop: space.lg, fontSize: font.xs }}>
              {t("power.method")}
            </Muted>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rank: { width: 26, fontSize: font.sm, fontWeight: "700" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
});
