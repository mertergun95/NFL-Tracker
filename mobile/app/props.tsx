/** Prop Finder — bir oyuncunun/takımın seçilen çizgiyi geçme oranı.
 *
 *  Telefonda en çok işe yarayan ekran bu: eşiği artır/azalt, L5/L10/L20 ve
 *  ev/deplasman kutucuklarına bak. Son 20 maç çubuk grafikte, eşiğin üstü
 *  yeşil altı kırmızı.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge, { TeamStrip } from "../src/components/TeamBadge";
import PName from "../src/components/PName";
import PlayerAvatar from "../src/components/PlayerAvatar";
import { PropBars } from "../src/components/charts";
import {
  Card, Empty, Loading, Muted, PillRow, SearchBar, SectionHeader, Title, Trend,
} from "../src/components/ui";
import {
  loadManifest, loadPlayerIndex, loadPlayerWeeks, loadSchedule, loadTeamWeeks,
  seasonsFromManifest,
} from "../src/lib/data";
import { useAsync, useDebounced, useRefresh } from "../src/lib/hooks";
import { label, pct } from "../src/lib/columns";
import { teamName } from "../src/lib/teams";
import { translate, useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const PLAYER_STATS = [
  "receiving_yards", "receptions", "targets", "rushing_yards", "carries",
  "passing_yards", "completions", "attempts", "passing_tds",
  "passing_interceptions", "rushing_tds", "receiving_tds", "fantasy_points_ppr",
];
const TEAM_STATS = ["points", "points_allowed", "total_points", "passing_yards",
                    "rushing_yards", "total_yards", "def_sacks", "sacks_suffered"];
const TEAM_STAT_KEYS: Record<string, string> = {
  points: "props.pointsFor", points_allowed: "props.pointsAgainst",
  total_points: "props.totalPoints", total_yards: "props.totalYards",
  def_sacks: "props.sacksMade", sacks_suffered: "props.sacksTaken",
};
const statLabel = (s: string) =>
  TEAM_STAT_KEYS[s] ? translate(TEAM_STAT_KEYS[s]) : label(s);

/** Yard/puan statlarında büyük adım, sayaç statlarında küçük adım. */
const bigStep = (stat: string) =>
  stat.includes("yards") || stat.includes("points") || stat === "fantasy_points_ppr";

interface GameRow {
  season: number;
  week: number;
  ord: number;
  opp: string;
  home: boolean;
  value: number;
}

function hitRate(games: GameRow[], line: number) {
  const over = games.filter((g) => g.value > line).length;
  const push = games.filter((g) => g.value === line).length;
  const n = games.length - push;
  return { over, n, hit: n ? Math.round((100 * over) / n) : null };
}

function HitCard({ title, games, line }:
  { title: string; games: GameRow[]; line: number }) {
  const c = useColors();
  const { over, n, hit } = hitRate(games, line);
  const tone = hit === null ? c.textDim : hit >= 60 ? c.good : hit <= 40 ? c.bad : c.warn;
  return (
    <View style={[styles.hitCard, { borderColor: c.border, backgroundColor: c.bgRaised }]}>
      <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
        {title}
      </Text>
      <Text style={{ color: tone, fontSize: font.xl, fontWeight: "800" }}>
        {hit === null ? "—" : pct(hit)}
      </Text>
      <Text style={{ color: c.textDim, fontSize: 10 }}>
        {translate("props.over", { over, n })}
      </Text>
    </View>
  );
}

export default function PropFinder() {
  const t = useT();
  const c = useColors();
  const [mode, setMode] = useState<"player" | "team">("player");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [team, setTeam] = useState("PHI");
  const [stat, setStat] = useState("receiving_yards");
  const [lineChoice, setLineChoice] = useState<number | null>(null);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const loadSeasons = useMemo(() => seasons.slice(0, 3), [seasons]);

  const indexQ = useAsync((o) => loadPlayerIndex(o), []);
  const player = useMemo(
    () => indexQ.data?.find((p) => p.player_id === playerId) ?? null,
    [indexQ.data, playerId],
  );

  const bundleQ = useAsync(async (o) => {
    if (loadSeasons.length === 0) return [];
    return Promise.all(loadSeasons.map(async (s) => ({
      season: s,
      pw: await loadPlayerWeeks(s, o),
      tw: await loadTeamWeeks(s, o),
      sched: await loadSchedule(s, o),
    })));
  }, [loadSeasons.join()]);

  const { refreshing, onRefresh } = useRefresh([indexQ.reload, bundleQ.reload]);

  /** (sezon, hafta, takım) -> ev sahibi mi */
  const homeMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const b of bundleQ.data ?? [])
      for (const g of b.sched) {
        m.set(`${b.season}-${g.week}-${g.home_team}`, true);
        m.set(`${b.season}-${g.week}-${g.away_team}`, false);
      }
    return m;
  }, [bundleQ.data]);

  const games = useMemo((): GameRow[] => {
    const bundle = bundleQ.data;
    if (!bundle) return [];
    const rows: GameRow[] = [];
    if (mode === "player") {
      if (!playerId) return [];
      for (const b of bundle)
        for (const r of b.pw) {
          if (r.player_id !== playerId) continue;
          const v = r[stat];
          if (v === null || v === undefined) continue;
          rows.push({
            season: b.season, week: Number(r.week),
            ord: b.season * 100 + Number(r.week),
            opp: String(r.opponent_team ?? "?"),
            home: homeMap.get(`${b.season}-${r.week}-${r.team}`) ?? false,
            value: Number(v),
          });
        }
    } else {
      for (const b of bundle) {
        const twByWeek = new Map<string, StatRow>();
        for (const r of b.tw) if (r.team === team) twByWeek.set(String(r.week), r);
        for (const g of b.sched) {
          const isHome = g.home_team === team, isAway = g.away_team === team;
          if ((!isHome && !isAway) || g.home_score === null) continue;
          const pts = Number(isHome ? g.home_score : g.away_score);
          const ptsAll = Number(isHome ? g.away_score : g.home_score);
          const tw = twByWeek.get(String(g.week));
          const vals: Record<string, number | null> = {
            points: pts, points_allowed: ptsAll, total_points: pts + ptsAll,
            passing_yards: tw ? Number(tw.passing_yards ?? 0) : null,
            rushing_yards: tw ? Number(tw.rushing_yards ?? 0) : null,
            total_yards: tw
              ? Number(tw.passing_yards ?? 0) + Number(tw.rushing_yards ?? 0) : null,
            def_sacks: tw ? Number(tw.def_sacks ?? 0) : null,
            sacks_suffered: tw ? Number(tw.sacks_suffered ?? 0) : null,
          };
          const v = vals[stat];
          if (v === null || v === undefined || isNaN(v)) continue;
          rows.push({
            season: b.season, week: Number(g.week),
            ord: b.season * 100 + Number(g.week),
            opp: String(isHome ? g.away_team : g.home_team),
            home: isHome, value: v,
          });
        }
      }
    }
    return rows.sort((a, b) => a.ord - b.ord);
  }, [bundleQ.data, mode, playerId, team, stat, homeMap]);

  const desc = useMemo(() => [...games].reverse(), [games]);

  /** Varsayılan çizgi: son 10 maçın medyanı, .5'e yuvarlanır. */
  const line = useMemo(() => {
    if (lineChoice !== null) return lineChoice;
    const last10 = desc.slice(0, 10).map((g) => g.value).sort((a, b) => a - b);
    if (last10.length === 0) return 0.5;
    const med = last10[Math.floor(last10.length / 2)];
    return Math.max(0.5, Math.floor(med) + 0.5);
  }, [lineChoice, desc]);

  useEffect(() => { setLineChoice(null); }, [stat, playerId, team, mode]);

  const streak = useMemo(() => {
    if (desc.length === 0) return null;
    const side = desc[0].value > line;
    let n = 0;
    for (const g of desc) {
      if ((g.value > line) === side) n++;
      else break;
    }
    return n >= 3 ? { side, n } : null;
  }, [desc, line]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !indexQ.data) return [];
    return indexQ.data
      .filter((p) => String(p.player_name).toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, indexQ.data]);

  const step = bigStep(stat) ? 5 : 1;
  const chartGames = desc.slice(0, 20).reverse().map((g) => ({
    label: `${String(g.season).slice(2)}W${g.week}`,
    value: g.value,
    opp: g.opp,
  }));

  const bump = (d: number) => setLineChoice(Number((line + d).toFixed(1)));

  return (
    <>
      <Stack.Screen options={{ title: t("props.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Title sub={t("props.sub")}>{t("props.title")}</Title>

        <PillRow
          options={[
            { value: "player" as const, label: t("common.player") },
            { value: "team" as const, label: t("common.team") },
          ]}
          value={mode}
          onChange={(m) => { setMode(m); setStat(m === "team" ? "points" : "receiving_yards"); }}
        />

        {mode === "player" ? (
          <View style={{ marginTop: space.sm }}>
            <SearchBar value={search} onChange={setSearch}
                       placeholder={t("common.searchPlayer")} />
            {suggestions.length > 0 ? (
              <View style={{ marginTop: space.sm }}>
                {suggestions.map((p) => (
                  <Card
                    key={String(p.player_id)}
                    style={styles.suggestion}
                    onPress={() => { setPlayerId(String(p.player_id)); setSearch(""); }}
                  >
                    <Text style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                      {String(p.player_name)}
                    </Text>
                    <Muted>
                      {String(p.position ?? "")} ·{" "}
                      {String(p.current_team ?? p.team ?? "")}
                    </Muted>
                  </Card>
                ))}
              </View>
            ) : null}
            {player ? (
              <Card style={[styles.subject, { marginTop: space.sm }]}>
                <PlayerAvatar url={player.headshot_url as string}
                              name={String(player.player_name)} size={44} />
                <TeamBadge abbr={String(player.current_team ?? player.team ?? "")}
                           size={24} link />
                <View style={{ flex: 1 }}>
                  <PName name={String(player.player_name)}
                         pos={String(player.position ?? "")}
                         id={String(player.player_id)} size={font.md} />
                  <Muted>
                    {teamName(String(player.current_team ?? player.team ?? ""))}
                  </Muted>
                </View>
              </Card>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: space.sm }}>
            <TeamStrip value={team} onChange={(a) => a && setTeam(a)} />
            <Card style={styles.subject}>
              <TeamBadge abbr={team} size={34} link />
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                {teamName(team)}
              </Text>
            </Card>
          </View>
        )}

        <View style={{ marginTop: space.md }}>
          <PillRow
            options={(mode === "player" ? PLAYER_STATS : TEAM_STATS)
              .map((s) => ({ value: s, label: statLabel(s) }))}
            value={stat}
            onChange={setStat}
            compact
          />
        </View>

        {bundleQ.loading && !bundleQ.data ? <Loading /> : null}
        {mode === "player" && !playerId && !bundleQ.loading ? (
          <Empty text={t("props.pickPlayer2")} />
        ) : null}

        {games.length > 0 ? (
          <>
            <SectionHeader title={`${t("props.lineLabel")} · ${statLabel(stat)}`} />
            <View style={styles.lineBar}>
              <Pressable onPress={() => bump(-step)} style={[styles.step,
                         { borderColor: c.border, backgroundColor: c.bgSoft }]}>
                <Text style={{ color: c.text, fontSize: font.md }}>−{step}</Text>
              </Pressable>
              <Pressable onPress={() => bump(-0.5)} style={[styles.step,
                         { borderColor: c.border, backgroundColor: c.bgSoft }]}>
                <Text style={{ color: c.text, fontSize: font.md }}>−.5</Text>
              </Pressable>
              <View style={[styles.lineValue, { borderColor: c.accent,
                                                backgroundColor: c.bgRaised }]}>
                <Text style={{ color: c.text, fontSize: font.xl, fontWeight: "800" }}>
                  {line}
                </Text>
              </View>
              <Pressable onPress={() => bump(0.5)} style={[styles.step,
                         { borderColor: c.border, backgroundColor: c.bgSoft }]}>
                <Text style={{ color: c.text, fontSize: font.md }}>+.5</Text>
              </Pressable>
              <Pressable onPress={() => bump(step)} style={[styles.step,
                         { borderColor: c.border, backgroundColor: c.bgSoft }]}>
                <Text style={{ color: c.text, fontSize: font.md }}>+{step}</Text>
              </Pressable>
            </View>

            {streak ? (
              <View style={{ flexDirection: "row", alignItems: "center",
                             marginTop: space.sm }}>
                <Trend kind={streak.side ? "up" : "down"} />
                <Text style={{ color: streak.side ? c.good : c.link, fontSize: font.sm,
                               fontWeight: "700" }}>
                  {t(streak.side ? "props.streakOver" : "props.streakUnder",
                     { n: streak.n })}
                </Text>
              </View>
            ) : null}

            <SectionHeader title={t("props.hitRates")} />
            <View style={styles.hitGrid}>
              <HitCard title={t("props.last", { n: 5 })} games={desc.slice(0, 5)} line={line} />
              <HitCard title={t("props.last", { n: 10 })} games={desc.slice(0, 10)} line={line} />
              <HitCard title={t("props.last", { n: 20 })} games={desc.slice(0, 20)} line={line} />
              <HitCard title={t("common.home")} games={desc.filter((g) => g.home)} line={line} />
              <HitCard title={t("common.away")} games={desc.filter((g) => !g.home)} line={line} />
              {loadSeasons.map((s) => (
                <HitCard key={s} title={String(s)}
                         games={desc.filter((g) => g.season === s)} line={line} />
              ))}
            </View>

            <SectionHeader title={t("props.last20", { stat: statLabel(stat) })} />
            <Card>
              <PropBars games={chartGames} line={line} />
            </Card>

            <SectionHeader title={t("props.altLines")} />
            <Card>
              {[line - 2 * step, line - step, line, line + step, line + 2 * step]
                .filter((l) => l > 0)
                .map((l) => {
                  const cell = (gs: GameRow[]) => {
                    const { over, n, hit } = hitRate(gs, l);
                    return hit === null ? "—" : `${pct(hit)} (${over}/${n})`;
                  };
                  const active = l === line;
                  return (
                    <Pressable
                      key={l}
                      onPress={() => setLineChoice(l)}
                      style={[styles.altRow, {
                        borderBottomColor: c.border,
                        backgroundColor: active ? c.bgRaised : "transparent",
                      }]}
                    >
                      <Text style={{ color: active ? c.accent : c.text, fontSize: font.sm,
                                     fontWeight: "700", width: 52 }}>
                        {l}
                      </Text>
                      <Text style={{ color: c.textDim, fontSize: font.xs, flex: 1 }}>
                        L5 {cell(desc.slice(0, 5))}
                      </Text>
                      <Text style={{ color: c.textDim, fontSize: font.xs, flex: 1 }}>
                        L10 {cell(desc.slice(0, 10))}
                      </Text>
                      <Text style={{ color: c.textDim, fontSize: font.xs, flex: 1 }}>
                        L20 {cell(desc.slice(0, 20))}
                      </Text>
                    </Pressable>
                  );
                })}
            </Card>
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
  subject: { flexDirection: "row", alignItems: "center", gap: space.md },
  lineBar: { flexDirection: "row", alignItems: "center", gap: space.sm },
  step: {
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.sm, borderWidth: 1, minWidth: 46, alignItems: "center",
  },
  lineValue: {
    flex: 1, alignItems: "center", paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1.5,
  },
  hitGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  hitCard: {
    width: "31%", borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.sm, paddingVertical: space.sm, gap: 1,
  },
  altRow: {
    flexDirection: "row", alignItems: "center", gap: space.xs,
    paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
