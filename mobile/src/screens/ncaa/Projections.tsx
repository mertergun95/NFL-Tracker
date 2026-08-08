/** NCAA haftalık projeksiyonlar.
 *  Motor sezgisel (heuristic) olduğu için taban–tavan bandı yok; kartlar
 *  pozisyona göre üç ana statı gösteriyor. */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import StatTable from "../../components/StatTable";
import PName from "../../components/PName";
import NcaaBadge, { NcaaTeamCell } from "../../components/NcaaBadge";
import {
  Card, Empty, Loading, Muted, PillRow, SearchBar, SectionHeader, Title,
} from "../../components/ui";
import { loadNcaaProjections, NCAA_POSITIONS } from "../../lib/ncaa";
import { useAsync, useDebounced, useRefresh } from "../../lib/hooks";
import { fmt, label } from "../../lib/columns";
import { useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import type { StatRow } from "../../lib/types";

const ALL = "ALL";

const POS_COLS: Record<string, string[]> = {
  QB: ["proj_completions", "proj_attempts", "proj_passing_yards", "proj_passing_tds",
       "proj_passing_interceptions", "proj_carries", "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds",
       "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_receptions", "proj_receiving_yards", "proj_receiving_tds",
       "proj_carries", "proj_rushing_yards"],
};
const ALL_COLS = [
  "proj_passing_yards", "proj_passing_tds", "proj_carries", "proj_rushing_yards",
  "proj_rushing_tds", "proj_receptions", "proj_receiving_yards", "proj_receiving_tds",
];
const SORT: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards", WR: "proj_receiving_yards",
};
const CARD_STATS: Record<string, string[]> = {
  QB: ["passing_yards", "passing_tds", "rushing_yards"],
  RB: ["rushing_yards", "carries", "receiving_yards"],
  WR: ["receiving_yards", "receptions", "receiving_tds"],
};

function matcher(q: string): (p: StatRow) => boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return () => true;
  return (p) =>
    [p.player_name, p.team, p.opponent, p.position]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
}

export default function NcaaProjections() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [pos, setPos] = useState("QB");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const projQ = useAsync((o) => loadNcaaProjections(o), []);
  const { refreshing, onRefresh } = useRefresh([projQ.reload]);
  const data = projQ.data;

  const match = useMemo(() => matcher(query), [query]);
  const rows = useMemo(
    () => (data?.rows ?? [])
      .filter(pos === ALL ? () => true : (p) => p.position === pos)
      .filter(match),
    [data, pos, match],
  );
  const sortCol = pos === ALL ? "proj_passing_yards" : SORT[pos];
  const cardRows = useMemo(
    () => [...rows].sort((a, b) => Number(b[sortCol] ?? 0) - Number(a[sortCol] ?? 0)),
    [rows, sortCol],
  );

  if (projQ.loading && !data) return <Screen><Loading /></Screen>;
  if (!data)
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Title>{t("ncaa.projTitle")}</Title>
        <Empty text={t("ncaa.projNotReady")} />
      </Screen>
    );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey="ncaa/projections.json">
      {/* projSub web'de bir bağlantıyla bitiyor ("… for accuracy see <link>");
          burada cümleyi karne ekranının adıyla tamamlıyoruz. */}
      <Title sub={`${t("ncaa.projSub", { season: data.target.season,
                                         week: data.target.week })} ${t("acc.title")}.`}>
        {t("ncaa.projTitle")}
      </Title>

      <PillRow
        options={[
          { value: "cards" as const, label: t("m.byPosition") },
          { value: "table" as const, label: t("common.stat") },
        ]}
        value={view}
        onChange={setView}
      />
      <PillRow
        options={[ALL, ...NCAA_POSITIONS].map((p) => ({
          value: p, label: p === ALL ? t("common.all") : p,
        }))}
        value={pos}
        onChange={setPos}
        compact
      />
      <View style={{ height: space.sm }} />
      <SearchBar value={search} onChange={setSearch}
                 placeholder={t("ncaa.searchPlayerTeam")} />

      <Muted style={{ marginTop: space.md }}>
        {t("proj.count", { n: rows.length, total: data.rows.length })}
      </Muted>

      {view === "cards" ? (
        <View style={{ marginTop: space.md }}>
          {cardRows.slice(0, 60).map((row) => {
            const stats = CARD_STATS[String(row.position)] ?? CARD_STATS.WR;
            return (
              <Card
                key={String(row.player_id)}
                style={{ marginBottom: space.sm }}
                onPress={() => router.push(`/ncaa/player/${row.player_id}`)}
              >
                <View style={styles.head}>
                  <NcaaBadge abbr={String(row.team)} size={28} />
                  <View style={{ flex: 1 }}>
                    <PName name={String(row.player_name)} pos={String(row.position)}
                           size={font.md} />
                    <Muted style={{ marginTop: 2 }}>
                      {String(row.team)} {row.is_home ? "vs" : "@"} {String(row.opponent)}
                    </Muted>
                  </View>
                </View>
                <View style={styles.statRow}>
                  {stats.map((s) => (
                    <View key={s} style={{ flex: 1 }}>
                      <Text numberOfLines={1}
                            style={{ color: c.textDim, fontSize: font.xs }}>
                        {label(s)}
                      </Text>
                      <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "700" }}>
                        {fmt(`proj_${s}`, row[`proj_${s}`])}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
          {cardRows.length === 0 ? <Empty text={t("table.empty")} /> : null}
        </View>
      ) : (
        <View style={{ marginTop: space.md }}>
          <StatTable
            rows={rows}
            columns={["player_name", "team", "opponent",
                      ...(pos === ALL ? ALL_COLS : POS_COLS[pos] ?? [])]}
            defaultSort={sortCol}
            onRowPress={(row) => router.push(`/ncaa/player/${row.player_id}`)}
            render={{
              player_name: (row) => (
                <PName name={String(row.player_name)} pos={String(row.position ?? "")} />
              ),
              team: (row) => <NcaaTeamCell abbr={row.team as string} size={18}
                                           showAbbr={false} />,
              opponent: (row) => <NcaaTeamCell abbr={row.opponent as string} size={18}
                                               showAbbr={false} />,
            }}
            colWidth={72}
          />
        </View>
      )}

      <SectionHeader title={t("m.accuracyShort")} action={t("m.seeAll")}
                     onAction={() => router.push("/ncaa/accuracy")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  statRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
});
