/** Oyuncu karşılaştırma — en fazla 3 oyuncu.
 *
 *  Web'de oyuncu başına bir sütun var; telefonda 3 sütunluk tablo dar
 *  kalıyor, o yüzden her stat satırı kendi kartında ve en iyi değer
 *  vurgulanıyor. Haftalık seyir çok serili çizgi grafiğinde.
 */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import { MultiLineChart, SERIES_COLORS } from "../src/components/charts";
import {
  Card, Empty, Loading, Muted, PillRow, SearchBar, SectionHeader, Title,
} from "../src/components/ui";
import {
  loadManifest, loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks,
  seasonsFromManifest,
} from "../src/lib/data";
import { useAsync, useDebounced, useRefresh } from "../src/lib/hooks";
import { fmt, label, presetForPosition } from "../src/lib/columns";
import { useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const MAX_PLAYERS = 3;
/** Düşükken iyi olan statlar — vurgu ters çevrilir. */
const LOWER_BETTER = new Set(["passing_interceptions", "sacks_suffered",
                              "rushing_fumbles", "rushing_fumbles_lost"]);

interface Sel { id: string; season: number }

export default function Compare() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [sel, setSel] = useState<Sel[]>([]);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const [statChoice, setStatChoice] = useState<string | null>(null);
  const [cumulative, setCumulative] = useState(false);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];

  const indexQ = useAsync((o) => loadPlayerIndex(o), []);

  const suggestions = useMemo(() => {
    if (!indexQ.data || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return indexQ.data
      .filter((p) => String(p.player_name ?? "").toLowerCase().includes(q)
                     && !sel.some((s) => s.id === p.player_id))
      .sort((a, b) => {
        const score = (p: StatRow) => {
          const name = String(p.player_name ?? "").toLowerCase();
          const wordStart = name.split(/\s+/).some((w) => w.startsWith(q)) ? 100 : 0;
          return wordStart + Number(p.last_season ?? 0) - 2000;
        };
        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [indexQ.data, query, sel]);

  const dataQ = useAsync(async (o) => {
    return Promise.all(sel.map(async (s) => {
      const [seasonRows, weekRows] = await Promise.all([
        loadPlayerSeason(s.season, o).catch(() => [] as StatRow[]),
        loadPlayerWeeks(s.season, o).catch(() => [] as StatRow[]),
      ]);
      return {
        ...s,
        season_row: seasonRows.find((r) => r.player_id === s.id) ?? null,
        weeks: weekRows
          .filter((r) => r.player_id === s.id && r.season_type === "REG")
          .sort((a, b) => Number(a.week) - Number(b.week)),
      };
    }));
  }, [JSON.stringify(sel)]);

  const { refreshing, onRefresh } = useRefresh([indexQ.reload, dataQ.reload]);

  const players = dataQ.data ?? [];
  const nameOf = (s: Sel) =>
    String(indexQ.data?.find((p) => p.player_id === s.id)?.player_name ?? s.id);

  const pos = String(players[0]?.season_row?.position
    ?? indexQ.data?.find((p) => p.player_id === sel[0]?.id)?.position ?? "");
  const stats = presetForPosition(pos || null);
  const chartStat = statChoice && stats.includes(statChoice) ? statChoice : stats[0];

  const series = useMemo(() => players
    .filter((p) => p.weeks.length > 0)
    .map((p, i) => ({
      name: `${nameOf(p)} (${p.season})`,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: (cumulative
        ? p.weeks.reduce<{ x: number; y: number }[]>((acc, r) => {
            const prev = acc.length ? acc[acc.length - 1].y : 0;
            acc.push({ x: Number(r.week), y: prev + Number(r[chartStat] ?? 0) });
            return acc;
          }, [])
        : p.weeks.map((r) => ({ x: Number(r.week), y: Number(r[chartStat] ?? 0) }))),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, cumulative, chartStat, indexQ.data]);

  /** Bir stat satırında en iyi oyuncunun indeksi (yoksa -1). */
  const bestIdx = (s: string): number => {
    const vals = players.map((p) => Number(p.season_row?.[s] ?? NaN));
    const valid = vals.filter((v) => !Number.isNaN(v));
    if (valid.length < 2) return -1;
    const best = LOWER_BETTER.has(s) ? Math.min(...valid) : Math.max(...valid);
    return vals.indexOf(best);
  };

  const addPlayer = (p: StatRow) => {
    if (sel.length >= MAX_PLAYERS) return;
    setSel([...sel, {
      id: String(p.player_id),
      season: Number(p.last_season ?? seasons[0] ?? 0),
    }]);
    setSearch("");
  };

  const cycleSeason = (i: number) => {
    const cur = sel[i];
    const at = seasons.indexOf(cur.season);
    const next = seasons[(at + 1) % Math.max(1, seasons.length)] ?? cur.season;
    const copy = [...sel];
    copy[i] = { ...cur, season: next };
    setSel(copy);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("compare.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="players/index.json">
        <Title sub={t("compare.sub2", { max: MAX_PLAYERS })}>{t("compare.title")}</Title>

        {sel.length < MAX_PLAYERS ? (
          <SearchBar value={search} onChange={setSearch} placeholder={t("compare.add")} />
        ) : null}

        {suggestions.length > 0 ? (
          <View style={{ marginTop: space.sm }}>
            {suggestions.map((p) => (
              <Card
                key={String(p.player_id)}
                style={styles.suggestion}
                onPress={() => addPlayer(p)}
              >
                <Text style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                  {String(p.player_name)}
                </Text>
                <Muted>
                  {String(p.position ?? "?")} · {String(p.team ?? "?")} ·{" "}
                  {String(p.last_season ?? "")}
                </Muted>
                <Text style={{ color: c.link, fontSize: font.lg, fontWeight: "700" }}>+</Text>
              </Card>
            ))}
          </View>
        ) : null}

        {sel.length > 0 ? (
          <View style={styles.chips}>
            {sel.map((s, i) => (
              <View
                key={s.id}
                style={[styles.chip, { borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
                                       backgroundColor: c.bgSoft }]}
              >
                <Text numberOfLines={1}
                      style={{ color: SERIES_COLORS[i % SERIES_COLORS.length],
                               fontSize: font.sm, fontWeight: "700", maxWidth: 130 }}>
                  {nameOf(s)}
                </Text>
                <Pressable onPress={() => cycleSeason(i)} hitSlop={6}>
                  <Text style={{ color: c.text, fontSize: font.xs }}>{s.season} ⇄</Text>
                </Pressable>
                <Pressable onPress={() => setSel(sel.filter((x) => x.id !== s.id))}
                           hitSlop={8}>
                  <Text style={{ color: c.textDim, fontSize: font.sm }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Empty text={t("compare.empty")} />
        )}

        {dataQ.loading && sel.length > 0 ? <Loading /> : null}

        {players.length > 0 ? (
          <>
            <SectionHeader title={t("compare.seasonTotals")} />
            {["team", "games", ...stats].map((s) => {
              const best = bestIdx(s);
              return (
                <Card key={s} style={{ marginBottom: 6 }}>
                  <Text style={{ color: c.textDim, fontSize: font.xs,
                                 marginBottom: 4 }}>
                    {label(s)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    {players.map((p, i) => (
                      <View key={p.id + p.season} style={{ flex: 1 }}>
                        <Text style={{
                          color: i === best ? c.good : c.text,
                          fontSize: font.md,
                          fontWeight: i === best ? "800" : "600",
                        }}>
                          {p.season_row ? fmt(s, p.season_row[s] ?? null) : "—"}
                        </Text>
                        <Text numberOfLines={1}
                              style={{ color: SERIES_COLORS[i % SERIES_COLORS.length],
                                       fontSize: 9 }}>
                          {nameOf(p)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })}

            <SectionHeader title={t("compare.weekByWeek")} />
            <PillRow
              options={stats.map((s) => ({ value: s, label: label(s) }))}
              value={chartStat}
              onChange={setStatChoice}
              compact
            />
            <Pressable
              onPress={() => setCumulative((v) => !v)}
              style={[styles.toggle, {
                borderColor: cumulative ? c.accent : c.border,
                backgroundColor: cumulative ? c.accent : c.bgSoft,
              }]}
            >
              <Text style={{ color: cumulative ? c.accentText : c.text,
                             fontSize: font.xs, fontWeight: "700" }}>
                {t("compare.cumulative")}
              </Text>
            </Pressable>

            {series.length > 0 ? (
              <Card style={{ marginTop: space.md }}>
                <MultiLineChart series={series} />
                <Muted style={{ marginTop: space.sm }}>{label(chartStat)}</Muted>
              </Card>
            ) : null}

            {players.some((p) => p.season_row) ? (
              <Pressable
                onPress={() => router.push(`/player/${players[0].id}`)}
                style={{ marginTop: space.lg }}
              >
                <Text style={{ color: c.link, fontSize: font.sm, fontWeight: "600" }}>
                  {nameOf(players[0])} → {t("m.profile")}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  suggestion: {
    flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: 6,
  },
  chips: {
    flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 6,
  },
  toggle: {
    alignSelf: "flex-start", marginTop: space.sm,
    paddingHorizontal: space.lg, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1,
  },
});
