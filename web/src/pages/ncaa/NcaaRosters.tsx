import { useMemo, useState } from "react";
import NcaaLogo from "../../components/NcaaLogo";
import PName from "../../components/PName";
import { Loading } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaRosters, loadNcaaTeams, teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { useT } from "../../lib/i18n";

const UNIT_KEYS: Record<string, string> = {
  offense: "unit.offense", defense: "unit.defense", specialTeam: "unit.st",
};
const POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "OT", "G", "C", "OL",
                   "DE", "DT", "DL", "EDGE", "LB", "CB", "S", "DB",
                   "PK", "P", "LS", "ATH"];

export default function NcaaRosters() {
  const t = useT();
  const { data: rosters, loading } = useAsync(() => loadNcaaRosters(), []);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const teamList = useMemo(() => {
    const set = new Set((rosters ?? []).map((r) => String(r.team)));
    return [...set].sort((a, b) =>
      (tmap.get(a)?.school ?? a).localeCompare(tmap.get(b)?.school ?? b));
  }, [rosters, tmap]);
  const [team, setTeam] = useState<string | null>(null);
  const active = team ?? teamList[0] ?? null;

  const byUnit = useMemo(() => {
    const rows = (rosters ?? []).filter((r) => String(r.team) === active);
    const units = new Map<string, typeof rows>();
    for (const r of rows) {
      const u = String(r.unit ?? "offense");
      if (!units.has(u)) units.set(u, []);
      units.get(u)!.push(r);
    }
    for (const list of units.values())
      list.sort((a, b) =>
        POS_ORDER.indexOf(String(a.position)) - POS_ORDER.indexOf(String(b.position))
        || String(a.player_name).localeCompare(String(b.player_name)));
    return [...units.entries()].sort(
      (a, b) => Object.keys(UNIT_KEYS).indexOf(a[0]) - Object.keys(UNIT_KEYS).indexOf(b[0]));
  }, [rosters, active]);

  if (loading) return <Loading />;
  if (!rosters)
    return <p className="empty">{t("ncaa.rostersNotReady")}</p>;

  return (
    <section>
      <h1>{t("ncaa.rostersTitle")}</h1>
      <p className="sub">
        {t("ncaa.rostersSub")}
      </p>
      <div className="toolbar">
        <NcaaLogo src={tmap.get(String(active))?.logo} size={34} />
        <select className="axis-select" value={String(active)}
                onChange={(e) => setTeam(e.target.value)}>
          {teamList.map((t) => (
            <option key={t} value={t}>
              {tmap.get(t)?.school ?? t} ({t})
            </option>
          ))}
        </select>
      </div>
      {byUnit.map(([unit, rows]) => (
        <div key={unit}>
          <h2>{t(UNIT_KEYS[unit] ?? unit)} ({rows.length})</h2>
          <StatTable rows={rows}
            columns={["jersey", "player_name", "position", "class"]}
            defaultSort="jersey"
            render={{
              player_name: (r) => (
                <PName name={String(r.player_name)}
                       pos={String(r.position ?? "")}
                       id={String(r.player_id)} base="/ncaa/player" />
              ),
            }} />
        </div>
      ))}
    </section>
  );
}
