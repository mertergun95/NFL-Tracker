/** Haftalık projeksiyonlar.
 *
 *  Web'de geniş bir tablo var; telefonda iki görünüm sunuluyor:
 *   - Kart: her oyuncu için ana stat + taban–tavan bandı (parmakla okunur),
 *   - Tablo: web'deki kolon setinin yana kayan hâli (karşılaştırma için).
 */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import StatTable from "../../components/StatTable";
import PName from "../../components/PName";
import TeamBadge, { TeamCell } from "../../components/TeamBadge";
import { RangeBar } from "../../components/charts";
import {
  Card, Empty, Loading, Muted, PillRow, SearchBar, SectionHeader, StatusBadge, Title,
} from "../../components/ui";
import { loadProjections } from "../../lib/data";
import { useAsync, useDebounced, useRefresh } from "../../lib/hooks";
import { fmt, label } from "../../lib/columns";
import { POS_PROJ_STATS, rangeOf } from "../../lib/projText";
import { useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import type { StatRow } from "../../lib/types";

const ALL = "ALL";
const POSITIONS = [ALL, "QB", "RB", "WR", "TE"];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
};

const POS_COLS: Record<string, string[]> = {
  QB: ["proj_attempts", "proj_completions", "proj_passing_yards", "proj_passing_tds",
       "proj_passing_interceptions", "proj_carries", "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds", "proj_targets",
       "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_targets", "proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
  TE: ["proj_targets", "proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
};
const ALL_COLS = [
  "proj_ppr", "proj_attempts", "proj_completions", "proj_passing_yards",
  "proj_passing_tds", "proj_passing_interceptions", "proj_carries",
  "proj_rushing_yards", "proj_rushing_tds", "proj_targets", "proj_receptions",
  "proj_receiving_yards", "proj_receiving_tds",
];
const POS_SORT: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards",
  WR: "proj_receiving_yards", TE: "proj_receiving_yards",
};

/** Kartta gösterilecek 3 ana stat (pozisyona göre). */
const CARD_STATS: Record<string, string[]> = {
  QB: ["passing_yards", "passing_tds", "rushing_yards"],
  RB: ["rushing_yards", "carries", "receiving_yards"],
  WR: ["receiving_yards", "receptions", "targets"],
  TE: ["receiving_yards", "receptions", "targets"],
};

function matcher(q: string): (p: StatRow) => boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return () => true;
  return (p) =>
    [p.player_name, p.team, p.opponent, p.position]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
}

function ProjectionCard({ row, showRange }: { row: StatRow; showRange: boolean }) {
  const c = useColors();
  const router = useRouter();
  const t = useT();
  const pos = String(row.position);
  const stats = CARD_STATS[pos] ?? CARD_STATS.WR;
  const primary = stats[0];
  const band = rangeOf(row, primary);

  return (
    <Card
      style={{ marginBottom: space.sm }}
      onPress={() => router.push(`/player/${row.player_id}`)}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <PName name={String(row.player_name)} pos={pos} size={font.md} />
          <View style={styles.inline}>
            <TeamBadge abbr={String(row.team)} size={16} />
            <Muted>
              {String(row.team)} vs {String(row.opponent)}
            </Muted>
            <StatusBadge status={row.injury_status as string} />
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: "800" }}>
            {fmt("proj_ppr", row.proj_ppr)}
          </Text>
          <Text style={{ color: c.textDim, fontSize: font.xs }}>P·PPR</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        {stats.map((s) => (
          <View key={s} style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
              {label(s)}
            </Text>
            <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "700" }}>
              {fmt(`proj_${s}`, row[`proj_${s}`])}
            </Text>
          </View>
        ))}
      </View>

      {showRange && band ? (
        <View style={{ marginTop: space.sm }}>
          <Text style={{ color: c.textDim, fontSize: font.xs, marginBottom: 4 }}>
            {t("m.floorCeiling")} · {label(primary)}
          </Text>
          <RangeBar lo={band[0]} mid={Number(row[`proj_${primary}`] ?? band[0])}
                    hi={band[1]} />
        </View>
      ) : null}
    </Card>
  );
}

export default function Projections() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [pos, setPos] = useState("WR");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const projQ = useAsync((o) => loadProjections(o), []);
  const { refreshing, onRefresh } = useRefresh([projQ.reload]);
  const data = projQ.data;

  const match = useMemo(() => matcher(query), [query]);
  const rows = useMemo(
    () => (data?.rows ?? [])
      .filter(pos === ALL ? () => true : (POS_FILTER[pos] ?? (() => true)))
      .filter(match),
    [data, pos, match],
  );

  const cardRows = useMemo(() => {
    const sortCol = pos === ALL ? "proj_ppr" : POS_SORT[pos] ?? "proj_ppr";
    return [...rows].sort((a, b) => Number(b[sortCol] ?? 0) - Number(a[sortCol] ?? 0));
  }, [rows, pos]);

  if (projQ.loading && !data) return <Screen><Loading /></Screen>;
  if (!data)
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Title>{t("tab.projections")}</Title>
        <Empty text={t("proj.notReady")} />
      </Screen>
    );

  const isMl = data.engine === "ml";
  const tableCols = pos === ALL
    ? ["player_name", "team", "opponent", ...ALL_COLS]
    : ["player_name", "team", "opponent", ...(POS_COLS[pos] ?? [])];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey="projections.json">
      <Title
        sub={[t(isMl ? "proj.mlNote" : "proj.heurNote"),
              t("proj.dataNote", { season: data.data_season })]
          .map((s) => s.trim()).join(" ")}
      >
        {t("proj.title", { season: data.target.season, week: data.target.week })}
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
        options={POSITIONS.map((p) => ({ value: p, label: p === ALL ? t("common.all") : p }))}
        value={pos}
        onChange={setPos}
        compact
      />
      <View style={{ height: space.sm }} />
      <SearchBar value={search} onChange={setSearch}
                 placeholder={t("common.searchPlayerTeam")} />

      <Muted style={{ marginTop: space.md }}>
        {t("proj.count", { n: rows.length, total: data.rows.length })}
      </Muted>

      {view === "cards" ? (
        <View style={{ marginTop: space.md }}>
          {cardRows.slice(0, 60).map((row) => (
            <ProjectionCard key={String(row.player_id)} row={row} showRange={isMl} />
          ))}
          {cardRows.length === 0 ? <Empty text={t("table.empty")} /> : null}
          {cardRows.length > 60 ? (
            <Muted style={{ textAlign: "center", marginTop: space.sm }}>
              {t("m.results", { n: cardRows.length })} · {t("common.stat")} →
            </Muted>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: space.md }}>
          <StatTable
            rows={rows}
            columns={tableCols}
            defaultSort={pos === ALL ? "proj_ppr" : POS_SORT[pos]}
            onRowPress={(row) => router.push(`/player/${row.player_id}`)}
            render={{
              player_name: (row) => (
                <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                       id={String(row.player_id)} />
              ),
              team: (row) => <TeamCell abbr={row.team as string} size={18} showAbbr={false} />,
              opponent: (row) => (
                <TeamCell abbr={row.opponent as string} size={18} showAbbr={false} />
              ),
            }}
            colWidth={72}
          />
        </View>
      )}

      <SectionHeader title={t("m.accuracyShort")} action={t("m.seeAll")}
                     onAction={() => router.push("/accuracy")} />
      <Muted>{t("proj.rosterNote")}</Muted>
      <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: space.sm }}>
        {POS_PROJ_STATS[pos] ? POS_PROJ_STATS[pos].map(label).join(" · ") : ""}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  statRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
});
