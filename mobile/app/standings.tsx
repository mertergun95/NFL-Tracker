/** Puan durumu — divizyon ve konferans (seed) görünümü.
 *  Not: gerçek NFL tie-break kuralları bu veriyle hesaplanamıyor;
 *  sıralama galibiyet yüzdesi ve averajla yapılır (web ile aynı). */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge from "../src/components/TeamBadge";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, SectionHeader, Title,
} from "../src/components/ui";
import { loadManifest, loadTeamSeason, seasonsFromManifest } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { TEAMS } from "../src/lib/teams";
import { useT } from "../src/lib/i18n";
import { font, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const CONFERENCES = ["AFC", "NFC"] as const;
const DIVISIONS: Record<string, string[]> = {
  AFC: ["AFC East", "AFC North", "AFC South", "AFC West"],
  NFC: ["NFC East", "NFC North", "NFC South", "NFC West"],
};
const DIV_WINNERS = 4;
const PLAYOFF_SPOTS = 7;

interface Row extends StatRow {
  pct: number; diff: number; conf: string; div: string;
}

function buildRows(data: StatRow[] | null): Row[] {
  const out: Row[] = [];
  for (const r of data ?? []) {
    const div = TEAMS[String(r.team)]?.division;
    if (!div) continue;
    const w = Number(r.wins ?? 0), l = Number(r.losses ?? 0), tie = Number(r.ties ?? 0);
    const games = w + l + tie;
    out.push({
      ...r,
      conf: div.slice(0, 3),
      div,
      pct: games ? (w + tie / 2) / games : 0,
      diff: Number(r.points_for ?? 0) - Number(r.points_against ?? 0),
    });
  }
  return out;
}

const byRecord = (a: Row, b: Row) => b.pct - a.pct || b.diff - a.diff;

function seedConference(rows: Row[]): Row[] {
  const winners: Row[] = [];
  for (const div of DIVISIONS[rows[0]?.conf] ?? []) {
    const top = rows.filter((r) => r.div === div).sort(byRecord)[0];
    if (top) winners.push(top);
  }
  const rest = rows.filter((r) => !winners.includes(r)).sort(byRecord);
  return [...winners.sort(byRecord), ...rest];
}

function TeamRow({ row, seed, cut }: { row: Row; seed?: number; cut?: boolean }) {
  const c = useColors();
  const router = useRouter();
  return (
    <View>
      <Card
        style={styles.row}
        onPress={() => router.push(`/team/${row.team}`)}
      >
        {seed !== undefined ? (
          <Text style={{
            color: seed <= DIV_WINNERS ? c.good : c.textDim,
            fontSize: font.xs, fontWeight: "700", width: 16,
          }}>
            {seed}
          </Text>
        ) : null}
        <TeamBadge abbr={String(row.team)} size={24} />
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "600", flex: 1 }}>
          {String(row.team)}
        </Text>
        <Text style={{ color: c.text, fontSize: font.sm, width: 58, textAlign: "right" }}>
          {row.wins ?? 0}-{row.losses ?? 0}
          {Number(row.ties ?? 0) > 0 ? `-${row.ties}` : ""}
        </Text>
        <Text style={{ color: c.textDim, fontSize: font.xs, width: 42,
                       textAlign: "right" }}>
          {row.pct.toFixed(3).replace(/^0/, "")}
        </Text>
        <Text style={{
          color: row.diff > 0 ? c.good : row.diff < 0 ? c.warn : c.textDim,
          fontSize: font.sm, width: 46, textAlign: "right", fontWeight: "600",
        }}>
          {row.diff > 0 ? `+${row.diff}` : row.diff}
        </Text>
      </Card>
      {cut ? <View style={[styles.cut, { backgroundColor: c.accent }]} /> : null}
    </View>
  );
}

export default function Standings() {
  const t = useT();
  const [season, setSeason] = useState<number | null>(null);
  const [view, setView] = useState<"division" | "conference">("division");

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamsQ = useAsync(
    (o) => (active ? loadTeamSeason(active, o) : Promise.resolve([])), [active]);
  const { refreshing, onRefresh } = useRefresh([manifestQ.reload, teamsQ.reload]);

  const rows = useMemo(() => buildRows(teamsQ.data), [teamsQ.data]);
  const byConf = useMemo(() => {
    const m: Record<string, Row[]> = { AFC: [], NFC: [] };
    for (const r of rows) m[r.conf]?.push(r);
    return m;
  }, [rows]);

  return (
    <>
      <Stack.Screen options={{ title: t("standings.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `seasons/${active}/team_season.json` : undefined}>
        <Title sub={view === "conference" ? t("stand.seedNote") : t("standings.sub")}>
          {t("standings.title")}
        </Title>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />
        <PillRow
          options={[
            { value: "division" as const, label: t("stand.byDivision") },
            { value: "conference" as const, label: t("stand.byConference") },
          ]}
          value={view}
          onChange={setView}
          compact
        />

        {teamsQ.loading && !teamsQ.data ? <Loading /> : null}
        {teamsQ.error && !teamsQ.data ? (
          <ErrorBox msg={teamsQ.error} onRetry={() => teamsQ.reload(true)} />
        ) : null}

        {CONFERENCES.map((conf) => (
          <View key={conf}>
            <SectionHeader title={conf} />
            {view === "division"
              ? DIVISIONS[conf].map((div) => (
                  <View key={div} style={{ marginBottom: space.md }}>
                    <Muted style={{ marginBottom: space.xs }}>{div}</Muted>
                    {rows.filter((r) => r.div === div).sort(byRecord)
                      .map((r) => <TeamRow key={String(r.team)} row={r} />)}
                  </View>
                ))
              : seedConference(byConf[conf] ?? []).map((r, i) => (
                  <TeamRow key={String(r.team)} row={r} seed={i + 1}
                           cut={i === PLAYOFF_SPOTS - 1} />
                ))}
          </View>
        ))}

        {!teamsQ.loading && rows.length === 0 ? <Empty text={t("table.empty")} /> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    marginBottom: 6, paddingVertical: space.sm,
  },
  cut: { height: 2, marginBottom: space.sm, borderRadius: 1, opacity: 0.8 },
});
