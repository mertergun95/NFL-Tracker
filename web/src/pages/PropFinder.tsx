import { useEffect, useMemo, useState } from "react";
import PName from "../components/PName";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import { PropBarChart, type PropGame } from "../components/charts";
import { label, pct } from "../lib/columns";
import { loadPlayerIndex, loadPlayerWeeks, loadSchedule,
         loadTeamWeeks } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS, teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";
import { translate, useT } from "../lib/i18n";

const PLAYER_STATS = [
  "passing_yards", "completions", "attempts", "passing_tds",
  "passing_interceptions", "rushing_yards", "carries", "rushing_tds",
  "receiving_yards", "receptions", "targets", "receiving_tds",
  "fantasy_points_ppr",
];
const TEAM_STATS = ["points", "points_allowed", "total_points",
                    "passing_yards", "rushing_yards", "total_yards",
                    "def_sacks", "sacks_suffered"];
const TEAM_STAT_KEYS: Record<string, string> = {
  points: "props.pointsFor", points_allowed: "props.pointsAgainst",
  total_points: "props.totalPoints", total_yards: "props.totalYards",
  def_sacks: "props.sacksMade", sacks_suffered: "props.sacksTaken",
};
const teamStatLabel = (s: string) =>
  TEAM_STAT_KEYS[s] ? translate(TEAM_STAT_KEYS[s]) : label(s);

/** Yard/puan statlarında büyük adım, sayaç statlarında küçük adım. */
const bigStep = (stat: string) =>
  stat.includes("yards") || stat.includes("points") || stat === "fantasy_points_ppr";

interface GameRow {
  season: number;
  week: number;
  ord: number;       // kronolojik sıra anahtarı
  opp: string;
  home: boolean;
  value: number;
}

function hitRate(games: GameRow[], line: number) {
  const over = games.filter((g) => g.value > line).length;
  const push = games.filter((g) => g.value === line).length;
  const n = games.length - push;
  return { over, n, hit: n ? Math.round(100 * over / n) : null };
}

function HitCard({ title, games, line }:
  { title: string; games: GameRow[]; line: number }) {
  const { over, n, hit } = hitRate(games, line);
  const cls = hit === null ? "" : hit >= 60 ? "hit-good"
    : hit <= 40 ? "hit-bad" : "hit-mid";
  return (
    <div className={`prop-card ${cls}`}>
      <span className="prop-card-title">{title}</span>
      <span className="prop-card-pct">
        {hit === null ? "—" : pct(hit)}
      </span>
      <span className="prop-card-n">{translate("props.over", { over, n })}</span>
    </div>
  );
}

export default function PropFinder({ seasons }: { seasons: number[] }) {
  const t = useT();
  const loadSeasons = useMemo(() => seasons.slice(0, 3), [seasons]);
  const [mode, setMode] = useState<"player" | "team">("player");
  const [q, setQ] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [team, setTeam] = useState("PHI");
  const [stat, setStat] = useState("receiving_yards");
  const [lineChoice, setLineChoice] = useState<number | null>(null);
  const [opp, setOpp] = useState("");

  const { data: index } = useAsync(() => loadPlayerIndex(), []);
  const player = useMemo(
    () => index?.find((p) => p.player_id === playerId) ?? null,
    [index, playerId]);

  // Son 3 sezonun verileri (istek üzerine cache'lenir)
  const { data: bundle, loading } = useAsync(async () => {
    const per = await Promise.all(loadSeasons.map(async (s) => ({
      season: s,
      pw: await loadPlayerWeeks(s),
      tw: await loadTeamWeeks(s),
      sched: await loadSchedule(s),
    })));
    return per;
  }, [loadSeasons.join()]);

  // Ev/deplasman: schedule'dan (season, week, team) -> home
  const homeMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const b of bundle ?? [])
      for (const g of b.sched) {
        m.set(`${b.season}-${g.week}-${g.home_team}`, true);
        m.set(`${b.season}-${g.week}-${g.away_team}`, false);
      }
    return m;
  }, [bundle]);

  // Seçime göre maç listesi (kronolojik artan)
  const games = useMemo((): GameRow[] => {
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
        // Sayılar schedule'dan
        const twByWeek = new Map<string, StatRow>();
        for (const r of b.tw)
          if (r.team === team) twByWeek.set(String(r.week), r);
        for (const g of b.sched) {
          const isHome = g.home_team === team, isAway = g.away_team === team;
          if ((!isHome && !isAway) || g.home_score === null) continue;
          const pts = Number(isHome ? g.home_score : g.away_score);
          const ptsAll = Number(isHome ? g.away_score : g.home_score);
          const t = twByWeek.get(String(g.week));
          const vals: Record<string, number | null> = {
            points: pts, points_allowed: ptsAll, total_points: pts + ptsAll,
            passing_yards: t ? Number(t.passing_yards ?? 0) : null,
            rushing_yards: t ? Number(t.rushing_yards ?? 0) : null,
            total_yards: t ? Number(t.passing_yards ?? 0) + Number(t.rushing_yards ?? 0) : null,
            def_sacks: t ? Number(t.def_sacks ?? 0) : null,
            sacks_suffered: t ? Number(t.sacks_suffered ?? 0) : null,
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
  }, [bundle, mode, playerId, team, stat, homeMap]);

  const desc = useMemo(() => [...games].reverse(), [games]);

  // Varsayılan çizgi: son 10 maçın medyanı, .5'e yuvarlanır
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

  const statChoices = mode === "player" ? PLAYER_STATS : TEAM_STATS;
  const statLabel = teamStatLabel(stat);
  const step = bigStep(stat) ? 5 : 1;
  const altLines = [line - 2 * step, line - step, line, line + step,
                    line + 2 * step].filter((l) => l > 0);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !index) return [];
    return index
      .filter((p) => String(p.player_name).toLowerCase().includes(s))
      .slice(0, 10);
  }, [q, index]);

  const chartGames: PropGame[] = desc.slice(0, 20).reverse().map((g) => ({
    label: `${String(g.season).slice(2)}W${g.week}`,
    value: g.value, opp: g.opp,
  }));

  return (
    <section>
      <h1>{t("props.title")}</h1>
      <p className="sub">
        {t("props.sub")}
      </p>

      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${mode === "player" ? "active" : ""}`}
                  onClick={() => { setMode("player"); setStat("receiving_yards"); }}>
            {t("common.player")}
          </button>
          <button className={`pill ${mode === "team" ? "active" : ""}`}
                  onClick={() => { setMode("team"); setStat("points"); }}>
            {t("common.team")}
          </button>
        </div>
        {mode === "player" ? (
          <div className="prop-search">
            <input className="axis-select" placeholder={t("common.searchPlayer")}
                   value={q} onChange={(e) => setQ(e.target.value)} />
            {suggestions.length > 0 && (
              <div className="prop-suggest">
                {suggestions.map((p) => (
                  <button key={String(p.player_id)}
                          onClick={() => { setPlayerId(String(p.player_id)); setQ(""); }}>
                    {String(p.player_name)}
                    <span className="pos-tag">{String(p.position ?? "")}</span>
                    {" · "}{String(p.current_team ?? p.team ?? "")}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <select className="axis-select" value={team}
                  onChange={(e) => setTeam(e.target.value)}>
            {Object.keys(TEAMS).sort().map((t) => (
              <option key={t} value={t}>{teamName(t)}</option>
            ))}
          </select>
        )}
      </div>

      {mode === "player" && player && (
        <div className="player-header" style={{ marginTop: 4 }}>
          {player.headshot_url && (
            <img className="headshot" src={String(player.headshot_url)} alt=""
                 style={{ width: 56, height: 56 }}
                 onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div>
            <h2 style={{ margin: 0 }}>
              <PName name={String(player.player_name)}
                     pos={String(player.position ?? "")}
                     id={String(player.player_id)} />
            </h2>
            <p className="sub" style={{ margin: 0 }}>
              {teamName(String(player.current_team ?? player.team ?? ""))}
            </p>
          </div>
        </div>
      )}
      {mode === "team" && (
        <div className="player-header" style={{ marginTop: 4 }}>
          <TeamLogo abbr={team} size={48} />
          <h2 style={{ margin: 0 }}>{teamName(team)}</h2>
        </div>
      )}

      <div className="toolbar">
        <div className="pill-row">
          {statChoices.map((s) => (
            <button key={s} className={`pill small ${s === stat ? "active" : ""}`}
                    onClick={() => setStat(s)}>
              {teamStatLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading />}
      {mode === "player" && !playerId && !loading && (
        <p className="empty">{t("props.pickPlayer")}</p>
      )}

      {games.length > 0 && (
        <>
          <div className="toolbar prop-line-bar">
            <span className="axis-label">{t("props.line", { stat: statLabel })}</span>
            {[-step, -0.5].map((d) => (
              <button key={d} className="pill small"
                      onClick={() => setLineChoice(Number((line + d).toFixed(1)))}>
                {d}
              </button>
            ))}
            <input className="axis-select small" type="number" step="0.5"
                   style={{ width: 90 }} value={line}
                   onChange={(e) => setLineChoice(Number(e.target.value))} />
            {[0.5, step].map((d) => (
              <button key={d} className="pill small"
                      onClick={() => setLineChoice(Number((line + d).toFixed(1)))}>
                +{d}
              </button>
            ))}
            {streak && (
              <span className={`trend-chip ${streak.side ? "hot" : "cold"}`}>
                {t(streak.side ? "props.streakOver" : "props.streakUnder",
                   { n: streak.n })}
              </span>
            )}
          </div>

          <div className="prop-cards">
            <HitCard title={t("props.last", { n: 5 })} games={desc.slice(0, 5)} line={line} />
            <HitCard title={t("props.last", { n: 10 })} games={desc.slice(0, 10)} line={line} />
            <HitCard title={t("props.last", { n: 20 })} games={desc.slice(0, 20)} line={line} />
            {loadSeasons.map((s) => (
              <HitCard key={s} title={`${s}`}
                       games={desc.filter((g) => g.season === s)} line={line} />
            ))}
            <HitCard title={t("common.home")} games={desc.filter((g) => g.home)} line={line} />
            <HitCard title={t("common.away")}
                     games={desc.filter((g) => !g.home)} line={line} />
            {opp && (
              <HitCard title={t("props.vs", { team: opp })}
                       games={desc.filter((g) => g.opp === opp)} line={line} />
            )}
          </div>

          <div className="toolbar">
            <span className="axis-label">{t("props.oppSplit")}</span>
            <select className="axis-select" value={opp}
                    onChange={(e) => setOpp(e.target.value)}>
              <option value="">{t("props.pickOpp")}</option>
              {Object.keys(TEAMS).sort().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <h2>{t("props.last20", { stat: statLabel })}</h2>
          <PropBarChart games={chartGames} line={line} statLabel={statLabel} />

          <h2>{t("props.altLines")}</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>{t("props.line", { stat: "" }).replace(":", "")}</th>
                  <th>{t("props.last", { n: 5 })}</th>
                  <th>{t("props.last", { n: 10 })}</th>
                  <th>{t("props.last", { n: 20 })}</th>
                  <th>{t("props.seasonCol", { season: loadSeasons[0] })}</th>
                </tr>
              </thead>
              <tbody>
                {altLines.map((l) => {
                  const cell = (gs: GameRow[]) => {
                    const { over, n, hit } = hitRate(gs, l);
                    return hit === null ? "—" : `${pct(hit)} (${over}/${n})`;
                  };
                  return (
                    <tr key={l}
                        style={l === line ? { background: "#1c2430" } : undefined}>
                      <td><strong>{l}</strong>{l === line && t("props.selected")}</td>
                      <td className="num">{cell(desc.slice(0, 5))}</td>
                      <td className="num">{cell(desc.slice(0, 10))}</td>
                      <td className="num">{cell(desc.slice(0, 20))}</td>
                      <td className="num">
                        {cell(desc.filter((g) => g.season === loadSeasons[0]))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
