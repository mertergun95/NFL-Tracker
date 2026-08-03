/** Yön işareti — emoji yerine tipografik ok + anlam rengi.
 *
 * Eskiden 🔥/🧊 gibi emojiler hem insights başlıklarına hem de trend
 * metinlerine gömülüydü. Emojiler platformdan platforma farklı render
 * ediliyor, ekran okuyucularda gürültü yapıyor ve arayüzü ucuz
 * gösteriyordu. Yön artık veride yapısal bir alan (kind) ve burada tek
 * yerden görselleştiriliyor.
 */
export type TrendKind = "up" | "down" | "flat";

const GLYPH: Record<TrendKind, string> = { up: "▲", down: "▼", flat: "–" };

export default function Trend({ kind, label }:
  { kind: TrendKind | undefined; label?: string }) {
  if (!kind) return null;
  return (
    <span className={`trend trend-${kind}`}>
      <span aria-hidden="true">{GLYPH[kind]}</span>
      {label ? <span className="trend-label">{label}</span> : null}
    </span>
  );
}
