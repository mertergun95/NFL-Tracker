/** Oturumu rapora çevirir. Markdown tek kaynak: ekrandaki rapor da, panoya
 *  kopyalanan da, indirilen dosya da bu metinden üretilir. */
import { translate } from "../../lib/i18n";
import { teamName } from "../../lib/teams";
import {
  GAME_STEPS, PLAYER_STEPS, PROVIDER_NAMES, sourcesFor, TOOLS, tx,
  type FieldDef, type StepDef,
} from "./blueprint";
import { coverage, stepStatus } from "./session";
import type { PlayerEntry, StepState, WoaSession } from "./types";

const t = (k: string, p?: Record<string, string | number>) => translate(k, p);

function fieldLines(def: StepDef, state: StepState | undefined,
                    session: WoaSession, position?: string): string[] {
  const out: string[] = [];
  const push = (field: FieldDef, prefix: string) => {
    const keys = field.scope === "team"
      ? [[`${prefix}${field.key}.${session.away}`, session.away],
         [`${prefix}${field.key}.${session.home}`, session.home]]
      : [[`${prefix}${field.key}`, ""]];
    for (const [key, team] of keys) {
      const raw = state?.values?.[key];
      if (!raw || !raw.trim()) continue;
      const value = field.input === "select"
        ? tx(field.options?.find((o) => o.value === raw)?.label ?? raw)
        : field.input === "rating" ? `${raw}/5` : raw;
      out.push(`- ${tx(field.label)}${team ? ` (${team})` : ""}: ${value}${
        field.suffix ?? ""}`);
    }
  };
  for (const f of def.fields ?? []) push(f, "");
  for (const src of sourcesFor(def, position))
    for (const f of src.fields ?? []) push(f, `${src.tool}.`);
  return out;
}

function usedTools(def: StepDef, state: StepState | undefined,
                   position?: string): string[] {
  return sourcesFor(def, position)
    .filter((s) => state?.checks?.[s.tool])
    .map((s) => TOOLS[s.tool]?.name ?? s.tool);
}

function stepSection(def: StepDef, state: StepState | undefined,
                     session: WoaSession, position?: string): string[] {
  const lines: string[] = [];
  const status = stepStatus(state, def);
  const head = `#### ${def.id} · ${tx(def.title)}`;
  if (status === "skipped") return [head, `_${t("woa.report.skipped")}_`, ""];
  if (status === "empty") return [head, `_${t("woa.report.notCovered")}_`, ""];

  lines.push(head);
  if (def.notes === "perTeam") {
    if (state?.away?.trim())
      lines.push(`**${teamName(session.away)}** — ${state.away.trim()}`, "");
    if (state?.home?.trim())
      lines.push(`**${teamName(session.home)}** — ${state.home.trim()}`, "");
  } else if (state?.note?.trim()) {
    lines.push(state.note.trim(), "");
  }
  const fields = fieldLines(def, state, session, position);
  if (fields.length) lines.push(...fields, "");
  const tools = usedTools(def, state, position);
  if (tools.length) lines.push(`_${t("woa.report.sourcesUsed")}: ${tools.join(", ")}_`, "");
  return lines;
}

function playerSection(p: PlayerEntry, session: WoaSession): string[] {
  const lines = [`### ${p.name} · ${p.position} · ${p.team}`, ""];
  for (const def of PLAYER_STEPS)
    lines.push(...stepSection(def, p.steps[def.id], session, p.position));
  return lines;
}

export function buildMarkdown(session: WoaSession): string {
  const lines: string[] = [];
  const title = `${teamName(session.away)} @ ${teamName(session.home)}`;
  lines.push(`# WoA · ${title}`, "");
  lines.push(`_${session.season} · ${t("common.week")} ${session.week}${
    session.gameday ? ` · ${session.gameday}` : ""} · ${
    t("woa.report.stats", { season: session.dataSeason })}_`, "");

  const m1 = session.steps.M1?.values ?? {};
  if (m1.spread || m1.total) {
    lines.push(`**${t("woa.f.market")}:** ${m1.spread ?? "—"} / ${m1.total ?? "—"}`, "");
  }
  const thesis = session.steps.M8?.note?.trim();
  if (thesis) lines.push(`> ${thesis}`, "");

  lines.push(`## ${t("woa.report.game")}`, "");
  for (const def of GAME_STEPS)
    lines.push(...stepSection(def, session.steps[def.id], session));

  if (session.players.length) {
    lines.push(`## ${t("woa.report.players")}`, "");
    for (const p of session.players) lines.push(...playerSection(p, session));
  }

  const missing = [
    ...GAME_STEPS.filter((d) => stepStatus(session.steps[d.id], d) !== "filled")
      .map((d) => d.id),
  ];
  if (missing.length)
    lines.push(`## ${t("woa.report.gaps")}`, "", missing.join(", "), "");

  lines.push(`## ${t("woa.report.coverage")}`, "");
  for (const c of coverage(session)) {
    const total = c.used.length + c.unused.length;
    lines.push(`- **${PROVIDER_NAMES[c.provider]}** ${c.used.length}/${total}${
      c.unused.length ? ` — ${t("woa.report.unused")}: ${c.unused.join(", ")}` : ""}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function reportFilename(session: WoaSession): string {
  return `woa-${session.season}-w${session.week}-${session.away}-${session.home}.md`;
}
