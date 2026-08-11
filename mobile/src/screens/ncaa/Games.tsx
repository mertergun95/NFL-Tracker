/** NCAA maçları — hafta seçimi REG haftaları + tek "Bowl/Playoff" kovası.
 *  934 maçlık bir sezonda hafta başına ~60 maç düştüğü için arama var. */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import NcaaBadge from "../../components/NcaaBadge";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, SearchBar, Title,
} from "../../components/ui";
import {
  loadNcaaManifest, loadNcaaSchedule, loadNcaaTeams, ncaaOrd, teamMapOf,
} from "../../lib/ncaa";
import { seasonsFromManifest } from "../../lib/data";
import { useAsync, useDebounced, useRefresh } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { kickoffLocal } from "../../lib/time";
import { font, space, useColors } from "../../lib/theme";

const BOWL = 100;

export default function NcaaGames() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [ord, setOrd] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const schedQ = useAsync(
    (o) => (active ? loadNcaaSchedule(active, o) : Promise.resolve([])), [active]);
  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);
  const { refreshing, onRefresh } = useRefresh([schedQ.reload, teamsQ.reload]);

  useEffect(() => { setOrd(null); }, [active]);

  /** REG haftaları ayrı ayrı, POST tamamı tek kovada (bowl haftaları
   *  numarayla anlaşılmıyor). */
  const buckets = useMemo(() => {
    const set = new Set<number>();
    let hasPost = false;
    for (const g of schedQ.data ?? []) {
      const o = ncaaOrd(g);
      if (o >= BOWL) hasPost = true;
      else set.add(o);
    }
    const weeks = [...set].sort((a, b) => a - b);
    return hasPost ? [...weeks, BOWL] : weeks;
  }, [schedQ.data]);

  const defaultOrd = useMemo(() => {
    if (!schedQ.data || buckets.length === 0) return null;
    const counts = new Map<number, number>();
    for (const g of schedQ.data) {
      if (g.home_score === null) continue;
      const o = ncaaOrd(g) >= BOWL ? BOWL : ncaaOrd(g);
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }
    const full = [...counts.entries()].filter(([, n]) => n >= 8).map(([o]) => o);
    if (full.length > 0) return Math.max(...full);
    return counts.size > 0 ? Math.max(...counts.keys()) : buckets[0];
  }, [schedQ.data, buckets]);

  const activeOrd = ord ?? defaultOrd;

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (schedQ.data ?? [])
      .filter((g) => {
        const o = ncaaOrd(g);
        const bucket = o >= BOWL ? BOWL : o;
        return bucket === activeOrd;
      })
      .filter((g) => !q
        || String(g.home_team ?? "").toLowerCase().includes(q)
        || String(g.away_team ?? "").toLowerCase().includes(q)
        || String(g.name ?? "").toLowerCase().includes(q))
      .sort((a, b) => String(a.gameday).localeCompare(String(b.gameday)));
  }, [schedQ.data, activeOrd, query]);

  if (!manifestQ.loading && !manifestQ.data)
    return <Screen><Empty text={t("ncaa.notReadyGeneric")} /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey={active ? `ncaa/seasons/${active}/schedule.json` : undefined}>
      <Title sub={t("games.sub")}>{t("ncaa.gamesTitle")}</Title>

      <PillRow
        options={seasons.map((s) => ({ value: s, label: String(s) }))}
        value={active ?? 0}
        onChange={setSeason}
      />
      <PillRow
        options={buckets.map((o) => ({
          value: o,
          label: o >= BOWL ? t("ncaa.bowlPill") : `${t("common.weekShort")} ${o}`,
        }))}
        value={activeOrd ?? 0}
        onChange={setOrd}
        compact
      />
      <View style={{ height: space.sm }} />
      <SearchBar value={search} onChange={setSearch}
                 placeholder={t("common.searchTeam")} />

      {schedQ.loading && !schedQ.data ? <Loading /> : null}
      {schedQ.error && !schedQ.data ? (
        <ErrorBox msg={schedQ.error} onRetry={() => schedQ.reload(true)} />
      ) : null}

      <Muted style={{ marginTop: space.md, marginBottom: space.sm }}>
        {t("m.results", { n: games.length })}
      </Muted>

      {games.slice(0, 60).map((g) => {
        const played = g.home_score !== null;
        const away = String(g.away_team), home = String(g.home_team);
        const a = Number(g.away_score), h = Number(g.home_score);
        return (
          <Card
            key={String(g.game_id)}
            style={{ marginBottom: space.sm }}
            onPress={() => router.push(`/ncaa/game/${active}/${g.game_id}`)}
          >
            <View style={styles.row}>
              <View style={[styles.side, { justifyContent: "flex-start" }]}>
                <NcaaBadge abbr={away} size={28} />
                <View style={{ flexShrink: 1 }}>
                  <Text numberOfLines={1}
                        style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                    {away}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
                    {tmap.get(away)?.school ?? ""}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "center", minWidth: 58 }}>
                {played ? (
                  <Text style={{ fontSize: font.md, fontWeight: "800", color: c.text }}>
                    <Text style={{ color: a > h ? c.good : c.textDim }}>{a}</Text>
                    <Text style={{ color: c.textDim }}>–</Text>
                    <Text style={{ color: h > a ? c.good : c.textDim }}>{h}</Text>
                  </Text>
                ) : (
                  <Text style={{ color: c.textDim, fontSize: font.md }}>@</Text>
                )}
              </View>
              <View style={[styles.side, { justifyContent: "flex-end" }]}>
                <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
                  <Text numberOfLines={1}
                        style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                    {home}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
                    {tmap.get(home)?.school ?? ""}
                  </Text>
                </View>
                <NcaaBadge abbr={home} size={28} />
              </View>
            </View>
            <View style={styles.metaRow}>
              <Muted>
                {String(g.gameday)}
                {kickoffLocal(g.kickoff) ? ` · ${kickoffLocal(g.kickoff)}` : ""}
                {g.neutral_site ? t("game.neutral") : ""}
                {g.broadcast ? ` · ${String(g.broadcast)}` : ""}
              </Muted>
              {/* Almanya'dan izlenebilirlik: ESPN ailesi DAZN'de görünüyor */}
              {g.dazn ? (
                <View style={[styles.dazn, { backgroundColor: c.accent }]}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800",
                                 letterSpacing: 0.4 }}>
                    DAZN
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      {!schedQ.loading && games.length === 0 ? (
        <Empty text={t("common.noGameData")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: space.sm, flexWrap: "wrap",
  },
  dazn: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  side: { flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 },
});
