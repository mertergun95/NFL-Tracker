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
  return <p className="empty">Yükleniyor…</p>;
}

export function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="error-box">
      <p>Veri yüklenemedi: {msg}</p>
      <p>
        Veri seti henüz oluşturulmamış olabilir — GitHub Actions'taki
        <code> Update NFL Stats </code> workflow'unun (backfill) tamamlanmasını bekleyin.
      </p>
    </div>
  );
}
