import { useT } from "../lib/i18n";

interface SeasonPickerProps {
  seasons: number[];
  value: number;
  onChange: (s: number) => void;
}

export function SeasonPicker({ seasons, value, onChange }: SeasonPickerProps) {
  return (
    <div className="pill-row">
      {seasons.map((s) => (
        <button key={s} className={`pill ${s === value ? "active" : ""}`}
                onClick={() => onChange(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

interface PositionPickerProps {
  value: string;
  onChange: (p: string) => void;
}

export function PositionPicker({ value, onChange }: PositionPickerProps) {
  return (
    <div className="pill-row">
      {POSITIONS.map((p) => (
        <button key={p} className={`pill ${p === value ? "active" : ""}`}
                onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  const t = useT();
  return <p className="empty">{t("common.loading")}</p>;
}

export function ErrorMsg({ msg }: { msg: string }) {
  const t = useT();
  return (
    <div className="error-box">
      <p>{t("err.load", { msg })}</p>
      <p>{t("err.hint")}</p>
    </div>
  );
}
