/** Bir adımın tamamı: neden bakıyoruz → StatGrade paneli → dış kaynak
 *  checklist'i → notlar. Kaydetme otomatik, buton yalnızca sonraki adıma
 *  geçirir. */
import type { ReactNode } from "react";
import { useT } from "../../lib/i18n";
import TeamLogo from "../../components/TeamLogo";
import { PROVIDER_NAMES, sourcesFor, TOOLS, tx,
         type FieldDef, type StepDef } from "../core/blueprint";
import { setCheck, setValue } from "../core/session";
import type { StepState } from "../core/types";

interface Props {
  def: StepDef;
  state?: StepState;
  away: string;
  home: string;
  position?: string;
  onPatch: (patch: Partial<StepState>) => void;
  onNext?: () => void;
  panel: ReactNode;
}

function Field({ field, prefix, state, away, home, onPatch }: {
  field: FieldDef; prefix: string; state?: StepState; away: string; home: string;
  onPatch: (patch: Partial<StepState>) => void;
}) {
  const t = useT();
  const keys = field.scope === "team"
    ? [[`${prefix}${field.key}.${away}`, away], [`${prefix}${field.key}.${home}`, home]]
    : [[`${prefix}${field.key}`, ""]];

  return (
    <div className={`woa-field woa-field--${field.scope}`}>
      <span className="woa-field__label">{tx(field.label)}</span>
      {keys.map(([key, team]) => {
        const value = state?.values?.[key] ?? "";
        const set = (v: string) => onPatch(setValue(state, key, v));
        return (
          <label key={key} className="woa-field__slot">
            {team && <span className="woa-field__team">
              <TeamLogo abbr={team} size={16} /> {team}</span>}
            {field.input === "select" ? (
              <select value={value} onChange={(e) => set(e.target.value)}>
                <option value="">—</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{tx(o.label)}</option>
                ))}
              </select>
            ) : field.input === "rating" ? (
              <span className="woa-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button"
                          className={Number(value) >= n ? "on" : ""}
                          aria-label={`${tx(field.label)} ${n}`}
                          onClick={() => set(Number(value) === n ? "" : String(n))}>
                    ●
                  </button>
                ))}
              </span>
            ) : (
              <input type={field.input === "number" ? "number" : "text"}
                     inputMode={field.input === "number" ? "decimal" : undefined}
                     step="any" value={value} placeholder={t("woa.field.ph")}
                     onChange={(e) => set(e.target.value)} />
            )}
            {field.suffix && <span className="woa-dim">{field.suffix}</span>}
          </label>
        );
      })}
    </div>
  );
}

export default function StepCard({ def, state, away, home, position,
                                   onPatch, onNext, panel }: Props) {
  const t = useT();
  const sources = sourcesFor(def, position);
  const skipped = !!state?.skipped;

  const note = (key: "note" | "away" | "home", team?: string) => (
    <label className="woa-note">
      <span>
        {team ? <><TeamLogo abbr={team} size={18} /> {team}</> : t("woa.note.single")}
      </span>
      <textarea value={state?.[key] ?? ""} rows={4}
                placeholder={t("woa.note.ph")}
                onChange={(e) => onPatch({ [key]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onNext?.();
                }} />
    </label>
  );

  return (
    <article className={`woa-step${skipped ? " is-skipped" : ""}`}>
      <header className="woa-step__head">
        <div>
          <span className="woa-step__id">{def.id}</span>
          <h2>{tx(def.title)}</h2>
          {def.required && <span className="woa-lock" title={t("woa.step.required")}>🔒</span>}
        </div>
        <button type="button" className="pill small"
                onClick={() => onPatch({ skipped: !skipped })}>
          {skipped ? t("woa.step.unskip") : t("woa.step.skip")}
        </button>
      </header>
      <p className="woa-why">{tx(def.why)}</p>

      {panel}

      {def.fields && def.fields.length > 0 && (
        <div className="woa-fields">
          {def.fields.map((f) => (
            <Field key={f.key} field={f} prefix="" state={state}
                   away={away} home={home} onPatch={onPatch} />
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <section className="woa-sources">
          <h3>{t("woa.sources.title")}</h3>
          {sources.map((src) => {
            const tool = TOOLS[src.tool];
            if (!tool) return null;
            const checked = !!state?.checks?.[src.tool];
            return (
              <div key={src.tool} className={`woa-source${checked ? " is-done" : ""}`}>
                <label className="woa-source__head">
                  <input type="checkbox" checked={checked}
                         onChange={(e) => onPatch(setCheck(state, src.tool, e.target.checked))} />
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    {tool.name}
                  </a>
                  <span className={`woa-badge woa-badge--${tool.provider}`}>
                    {PROVIDER_NAMES[tool.provider]}
                  </span>
                  <span className="woa-tier">{t(`woa.tier.${tool.tier}`)}</span>
                </label>
                <p className="woa-source__bring">{tx(src.bring)}</p>
                {tool.warn && <p className="woa-warn woa-warn--soft">{tx(tool.warn)}</p>}
                {src.fields && src.fields.length > 0 && (
                  <div className="woa-fields">
                    {src.fields.map((f) => (
                      <Field key={f.key} field={f} prefix={`${src.tool}.`} state={state}
                             away={away} home={home} onPatch={onPatch} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <div className="woa-notes">
        {def.notes === "perTeam"
          ? <>{note("away", away)}{note("home", home)}</>
          : note("note")}
      </div>

      {onNext && (
        <div className="woa-step__foot">
          <button type="button" className="pill" onClick={onNext}>
            {t("woa.step.next")} <span className="woa-dim">⌃⏎</span>
          </button>
        </div>
      )}
    </article>
  );
}
