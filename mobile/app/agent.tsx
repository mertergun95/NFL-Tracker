/** NFL Agent — haftalık boom/bust çağrıları + bülten.
 *
 *  Sitedeki /agent sayfasının mobil karşılığı. Rakamları pipeline üretir,
 *  metni dil modeli yazar; ajanın çıktısı bilerek İngilizcedir, ekran
 *  çerçevesi uygulamanın dilini kullanır.
 */
import { Fragment, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import { Card, Empty, Loading, Muted, PillRow, SectionHeader, Title } from "../src/components/ui";
import PName from "../src/components/PName";
import TeamBadge from "../src/components/TeamBadge";
import { loadAgent } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { AgentPayload, AgentPick, AgentSignal } from "../src/lib/types";

type Tab = "boom" | "bust" | "bulletin" | "record";

function Signal({ s }: { s: AgentSignal }) {
  const c = useColors();
  const edge = s.tone === "up" ? c.good : s.tone === "down" ? c.bad : c.border;
  return (
    <View style={[styles.signal, { borderLeftColor: edge }]}>
      <Text style={{ color: c.textDim, fontSize: font.xs, lineHeight: 17 }}>
        <Text style={{ color: c.text, fontWeight: "700" }}>{s.label} </Text>
        {s.value}
      </Text>
    </View>
  );
}

/** Son maçların PPR'ı: küçük bir sütun şeridi (grafik kütüphanesi gerekmiyor). */
function RecentStrip({ pick }: { pick: AgentPick }) {
  const c = useColors();
  const t = useT();
  const games = pick.recent_games.filter((g) => g.ppr !== null);
  if (games.length === 0) return null;
  const max = Math.max(...games.map((g) => g.ppr as number), 1);
  return (
    <View style={[styles.strip, { borderBottomColor: c.border }]}>
      <Text style={{ color: c.textDim, fontSize: font.xs }}>{t("agent.lastGames")}</Text>
      {games.map((g) => (
        <View key={g.week} style={styles.stripCol}>
          <Text style={{ color: c.text, fontSize: 10 }}>{g.ppr}</Text>
          <View style={{ width: 18, height: Math.max(2, ((g.ppr as number) / max) * 26),
                         borderRadius: 2, backgroundColor: c.link }} />
          <Text style={{ color: c.textDim, fontSize: 9 }}>
            {t("common.weekShort")}{g.week}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PickCard({ pick }: { pick: AgentPick }) {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const boom = pick.kind === "boom";
  return (
    <Card style={{ marginBottom: space.sm, borderLeftWidth: 3,
                   borderLeftColor: boom ? c.good : c.bad }}>
      <View style={styles.head}>
        <View style={[styles.tag, { backgroundColor: boom ? c.goodBg : c.badBg }]}>
          <Text style={{ color: boom ? c.good : c.bad, fontSize: 10, fontWeight: "800",
                         letterSpacing: 0.5 }}>
            {t(boom ? "agent.boom" : "agent.bust").toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: pick.confidence === "high" ? c.text : c.textDim,
                       fontSize: font.xs }}>
          {t(`agent.conf.${pick.confidence}`)}
        </Text>
      </View>

      <View style={styles.nameRow}>
        <TeamBadge abbr={pick.team} size={20} />
        <View style={{ flexShrink: 1 }}>
          <PName name={pick.player_name} pos={pick.position} id={pick.player_id} />
        </View>
        <Pressable onPress={() => router.push(`/team/${pick.opponent}`)} hitSlop={6}>
          <Text style={{ color: c.textDim, fontSize: font.xs }}>
            {t("agent.vs")} <Text style={{ color: c.link }}>{pick.opponent}</Text>
          </Text>
        </Pressable>
      </View>

      {pick.angle ? (
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700",
                       marginTop: 4 }}>
          {pick.angle}
        </Text>
      ) : null}
      <Muted style={{ marginTop: 4, marginBottom: space.sm }}>{pick.note}</Muted>

      <RecentStrip pick={pick} />
      <View style={{ gap: 3 }}>
        {pick.signals.map((s) => <Signal key={s.key} s={s} />)}
      </View>
    </Card>
  );
}

function RecordTab({ data }: { data: AgentPayload }) {
  const c = useColors();
  const t = useT();
  const { boom, bust } = data.record ?? {};
  const graded = data.history.filter((h) => h.picks.some((p) => p.hit !== undefined));
  if (!boom?.n && !bust?.n) {
    return <Empty text={t("agent.noRecord")} />;
  }
  const pct = (r?: { hits: number; n: number }) =>
    r && r.n ? `${Math.round((r.hits / r.n) * 100)}% (${r.hits}/${r.n})` : "—";
  return (
    <>
      <Muted style={{ marginBottom: space.sm }}>
        {t("agent.recordSub", { n: data.record.weeks ?? 0 })}
      </Muted>
      <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.md }}>
        {([["agent.boomHitRate", boom], ["agent.bustHitRate", bust]] as const).map(
          ([key, rec]) => (
            <Card key={key} style={{ flex: 1 }}>
              <Text style={{ color: c.textDim, fontSize: font.xs }}>{t(key)}</Text>
              <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "700",
                             marginTop: 2 }}>
                {pct(rec)}
              </Text>
            </Card>
          ))}
      </View>
      {graded.slice(-3).reverse().map((week) => (
        <Fragment key={`${week.season}-${week.week}`}>
          <SectionHeader title={`${week.season} · ${t("common.week")} ${week.week}`} />
          {week.picks.filter((p) => p.hit !== undefined).map((p) => (
            <Card key={p.player_id} style={{ marginBottom: space.xs }}>
              <View style={styles.recRow}>
                <View style={{ flex: 1 }}>
                  <PName name={p.player_name} pos={p.position} id={p.player_id} />
                  <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: 2 }}>
                    {t(p.kind === "boom" ? "agent.boom" : "agent.bust")}
                    {" · "}{t("agent.projShort")} {p.proj_ppr ?? "—"}
                    {" · "}{t("agent.bar")} {p.bar ?? "—"}
                    {" · "}{t("agent.actual")} {p.actual_ppr ?? "—"}
                  </Text>
                </View>
                <Text style={{ color: p.hit ? c.good : c.textDim, fontSize: font.sm,
                               fontWeight: "700" }}>
                  {t(p.hit ? "agent.hit" : "agent.miss")}
                </Text>
              </View>
            </Card>
          ))}
        </Fragment>
      ))}
    </>
  );
}

export default function AgentScreen() {
  const t = useT();
  const c = useColors();
  const [tab, setTab] = useState<Tab>("boom");
  const q = useAsync((o) => loadAgent(o), []);
  const { refreshing, onRefresh } = useRefresh([q.reload]);

  if (q.loading && !q.data) return <Screen><Loading /></Screen>;

  const data = q.data;
  const picks = data?.picks ?? [];
  const shown = picks.filter((p) => p.kind === tab);

  return (
    <>
      <Stack.Screen options={{ title: t("agent.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh} freshnessKey="agent.json">
        {!data ? <Empty text={t("agent.notReady")} /> : (
          <>
            <Title sub={`${t("agent.sub", {
              season: data.target.season, week: data.target.week,
              ds: data.data_season, dw: data.through_week,
            })} ${data.generated_at.slice(0, 10)}`}>
              {t("agent.title")}
            </Title>

            <Card style={{ borderLeftWidth: 3, borderLeftColor: c.accent,
                           marginBottom: space.md }}>
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                {data.headline}
              </Text>
              <Muted style={{ marginTop: 4 }}>{data.overview}</Muted>
            </Card>

            <PillRow
              options={[
                { value: "boom", label: t("agent.boomList") },
                { value: "bust", label: t("agent.bustList") },
                { value: "bulletin", label: t("agent.bulletin") },
                { value: "record", label: t("agent.record") },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "boom" || tab === "bust" ? (
              <>
                <Muted style={{ marginVertical: space.sm }}>
                  {t(tab === "boom" ? "agent.boomSub" : "agent.bustSub")}
                </Muted>
                {shown.length === 0
                  ? <Empty text={t("table.empty")} />
                  : shown.map((p) => <PickCard key={p.player_id} pick={p} />)}
              </>
            ) : null}

            {tab === "bulletin" ? (
              data.sections.length === 0
                ? <Empty text={t("agent.noBulletin")} />
                : data.sections.map((s) => (
                    <Card key={s.title} style={{ marginTop: space.sm }}>
                      <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                        {s.title}
                      </Text>
                      <Muted style={{ marginTop: 4 }}>{s.body}</Muted>
                    </Card>
                  ))
            ) : null}

            {tab === "record" ? <View style={{ marginTop: space.sm }}>
              <RecordTab data={data} />
            </View> : null}

            <Muted style={{ marginTop: space.xl, fontSize: font.xs }}>
              {t("agent.method")}
              {data.engine === "rules" ? ` ${t("agent.rulesOnly")}` : ""}
            </Muted>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 6,
  },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  strip: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    marginBottom: space.sm, paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripCol: { alignItems: "center", gap: 2 },
  signal: { borderLeftWidth: 2, paddingLeft: 7 },
  recRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
