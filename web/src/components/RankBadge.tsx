/** Küçük renkli rozet: rakibin sırası ya da 0-10 fikstür skoru.
 *
 *  İki girdi biçimi var çünkü iki ölçek farklı yönde:
 *   - `rank` + `invert`: savunma sırası (1 = en iyi savunma = zor maç)
 *   - `score`: PFF SOS, 0-10 ve yüksek = kolay maç
 *  İkisi de aynı renk diline indirgeniyor — yeşil kolay, kırmızı zor.
 */
export default function RankBadge({ rank, total = 32, invert, score, title }: {
  rank?: number | null;
  total?: number;
  /** true ise küçük sıra = zor (savunma sıralaması böyle). */
  invert?: boolean;
  /** 0-10, yüksek = kolay. */
  score?: number | null;
  title?: string;
}) {
  if (rank === null || rank === undefined) {
    if (score === null || score === undefined) return null;
    const cls = score >= 6.5 ? "easy" : score <= 3.5 ? "hard" : "mid";
    return (
      <span className={`rank-badge ${cls}`} title={title}>
        {score.toFixed(1)}
      </span>
    );
  }
  // Sırayı 0..1 "kolaylık" ölçeğine çevir
  const ease = invert ? (rank - 1) / (total - 1) : 1 - (rank - 1) / (total - 1);
  const cls = ease >= 0.62 ? "easy" : ease <= 0.38 ? "hard" : "mid";
  return (
    <span className={`rank-badge ${cls}`} title={title}>
      #{rank}
    </span>
  );
}
