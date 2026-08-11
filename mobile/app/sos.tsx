/** Fikstür zorluğu (PFF) — yalnızca NFL.
 *
 *  0-10 ölçeğinde **yüksek = kolay maç**. Bu yön varsayılmadı, ölçüldü:
 *  haftalık değerle o hafta karşılaşılacak rakibin savunma reytingi
 *  arasındaki korelasyon -0.48 (n=512).
 *
 *  17 haftalık ısı haritası telefona sığmadığı için mevcut StatTable
 *  kullanılıyor: takım kolonu sabit, haftalar yana kayıyor.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Stack } from "expo-router";
import Screen from "../src/components/Screen";
import StatTable from "../src/components/StatTable";
import { TeamCell } from "../src/components/TeamBadge";
import { Empty, Loading, Muted, PillRow, Title } from "../src/components/ui";
import { loadSos } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const POSITIONS = ["QB", "RB", "WR", "TE", "DST"];
const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);

/** 0-10 -> hücre rengi. Ortada nötr, uçlarda doygun. */
function Cell({ value }: { value: unknown }) {
  const c = useColors();
  const t = useT();
  if (typeof value !== "number") {
    return <Text style={{ color: c.textDim, fontSize: font.xs }}>{t("sos.bye")}</Text>;
  }
  const easy = value >= 6.5;
  const hard = value <= 3.5;
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
      backgroundColor: easy ? c.goodBg : hard ? c.badBg : "transparent",
    }}>
      <Text style={{ color: easy ? c.good : hard ? c.bad : c.text,
                     fontSize: font.sm, fontWeight: easy || hard ? "700" : "400" }}>
        {value.toFixed(1)}
      </Text>
    </View>
  );
}

export default function SosScreen() {
  const t = useT();
  const [pos, setPos] = useState("RB");
  const q = useAsync((o) => loadSos(o), []);
  const { refreshing, onRefresh } = useRefresh([q.reload]);

  const rows = useMemo(
    () => (q.data ?? []).filter((r) => r.position === pos),
    [q.data, pos]);

  if (q.loading && !q.data) return <Screen><Loading /></Screen>;

  const columns = ["team", "season_sos", ...WEEKS.map((w) => `w${w}`)];
  const render: Record<string, (row: StatRow) => React.ReactNode> = {
    team: (row) => <TeamCell abbr={row.team as string} size={18} />,
    ...Object.fromEntries(
      WEEKS.map((w) => [`w${w}`, (row: StatRow) => <Cell value={row[`w${w}`]} />])),
  };

  return (
    <>
      <Stack.Screen options={{ title: t("sos.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh} freshnessKey="sos.json">
        {rows.length === 0 ? <Empty text={t("sos.notReady")} /> : (
          <>
            <Title sub={t("sos.sub")}>{t("sos.title")}</Title>
            <PillRow
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              value={pos}
              onChange={setPos}
            />
            <View style={{ height: space.sm }} />
            <StatTable
              rows={rows}
              columns={columns}
              defaultSort="season_sos"
              firstWidth={96}
              colWidth={62}
              render={render}
            />
            <Muted style={{ marginTop: space.lg, fontSize: font.xs }}>
              {t("sos.method")}
            </Muted>
          </>
        )}
      </Screen>
    </>
  );
}
