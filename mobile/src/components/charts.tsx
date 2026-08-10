/** Hafif grafikler — SVG ile elle çizilir.
 *
 *  Web'de recharts var; mobilde tam bir grafik kütüphanesi taşımak hem
 *  paketi büyütür hem de burada gerekenler basit: hafta hafta bir çubuk
 *  serisi ve taban–tavan bandı. İkisi de doğrudan react-native-svg ile
 *  çiziliyor, ek bağımlılık yok.
 */
import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { font, radius, space, useColors } from "../lib/theme";

export interface BarPoint {
  label: string;
  value: number;
  /** Vurgulanacak çubuk (ör. playoff haftası). */
  highlight?: boolean;
  /** Okumada gösterilecek ek bağlam (ör. rakip). */
  sub?: string;
}

/** Hafta hafta çubuk grafiği (maç logu görselleştirmesi).
 *
 *  Çubuğa dokununca o haftanın değeri üstteki okuma satırında yazılır.
 *  Çubuk tepelerini birleştiren çizgi, haftalar arası iniş/çıkışı
 *  çubukların tek başına veremediği kadar net gösterir.
 */
export function WeekBars({ data, height = 170, valueFormat, statLabel }: {
  data: BarPoint[];
  height?: number;
  valueFormat?: (v: number) => string;
  /** Okuma satırında değerin yanına yazılır ("Rec Yds" gibi). */
  statLabel?: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.abs(d.value))),
    [data],
  );

  // Seri değişince (başka stat seçildi) seçim sıfırlanmalı.
  useEffect(() => { setPicked(null); }, [data]);

  if (data.length === 0) return null;

  const fmtV = valueFormat ?? ((v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(1));

  const readTop = 22;
  const padBottom = 18;
  const padTop = 14;
  const plot = height - padBottom - padTop - readTop;
  const slot = width / data.length;
  const barW = Math.max(3, Math.min(26, slot * 0.62));
  const yOf = (v: number) => readTop + padTop + plot - (Math.abs(v) / max) * plot;
  const xOf = (i: number) => i * slot + slot / 2;

  const sel = picked !== null ? data[picked] : null;

  return (
    <View onLayout={onLayout}>
      {/* okuma satırı: seçili çubuk yoksa en yüksek değeri özetler */}
      <View style={styles.readout}>
        {sel ? (
          <>
            <Text style={{ color: c.text, fontSize: font.md, fontWeight: "800" }}>
              {fmtV(sel.value)}
            </Text>
            <Text style={{ color: c.textDim, fontSize: font.xs }}>
              {statLabel ? `${statLabel} · ` : ""}{sel.sub ?? sel.label}
            </Text>
          </>
        ) : (
          <Text style={{ color: c.textDim, fontSize: font.xs }}>
            {statLabel ? `${statLabel} — ` : ""}max {fmtV(max)}
          </Text>
        )}
      </View>

      <View
        style={{ height: height - readTop }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => {
          const i = Math.floor(e.nativeEvent.locationX / slot);
          setPicked(i >= 0 && i < data.length && i !== picked ? i : null);
        }}
      >
        {width > 0 ? (
          <Svg width={width} height={height - readTop}>
            <Line
              x1={0} y1={padTop + plot} x2={width} y2={padTop + plot}
              stroke={c.border} strokeWidth={1}
            />
            {data.map((d, i) => {
              const h = (Math.abs(d.value) / max) * plot;
              const x = i * slot + (slot - barW) / 2;
              const isSel = i === picked;
              return (
                <Rect
                  key={i}
                  x={x} y={padTop + plot - h} width={barW} height={Math.max(1, h)}
                  rx={2}
                  fill={isSel ? c.accent : d.highlight ? c.accent : c.link}
                  opacity={picked === null ? (d.highlight ? 1 : 0.85) : isSel ? 1 : 0.35}
                />
              );
            })}
            {/* haftalar arası bağlantı çizgisi */}
            {data.length > 1 ? (
              <Polyline
                points={data.map((d, i) => `${xOf(i)},${yOf(d.value) - readTop}`).join(" ")}
                fill="none"
                stroke={c.text}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.55}
              />
            ) : null}
            {data.map((d, i) => (
              <Circle
                key={`p${i}`}
                cx={xOf(i)} cy={yOf(d.value) - readTop} r={i === picked ? 4 : 2}
                fill={i === picked ? c.accent : c.text}
                opacity={i === picked ? 1 : 0.55}
              />
            ))}
            {data.map((d, i) => (
              <SvgText
                key={`l${i}`}
                x={xOf(i)}
                y={height - readTop - 5}
                fontSize={9}
                fill={i === picked ? c.text : c.textDim}
                fontWeight={i === picked ? "bold" : "normal"}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

/** Taban–tavan bandı: beklenen değeri aralık içinde konumlandırır. */
export function RangeBar({ lo, mid, hi, format }:
  { lo: number; mid: number; hi: number; format?: (v: number) => string }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const span = Math.max(hi - lo, 0.0001);
  const pos = Math.min(1, Math.max(0, (mid - lo) / span));
  const f = format ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)));

  return (
    <View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: c.bgRaised }]}
      >
        {width > 0 ? (
          <View
            style={[styles.marker, { backgroundColor: c.accent, left: pos * (width - 3) }]}
          />
        ) : null}
      </View>
      <View style={styles.rangeLabels}>
        <Text style={{ color: c.textDim, fontSize: font.xs }}>{f(lo)}</Text>
        <Text style={{ color: c.text, fontSize: font.xs, fontWeight: "700" }}>
          {f(mid)}
        </Text>
        <Text style={{ color: c.textDim, fontSize: font.xs }}>{f(hi)}</Text>
      </View>
    </View>
  );
}

/** Çok serili çizgi grafiği — oyuncu karşılaştırmasında hafta hafta seyir. */
export interface LineSeries {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

export function MultiLineChart({ series, height = 190, yFormat }:
  { series: LineSeries[]; height?: number; yFormat?: (v: number) => string }) {
  const c = useColors();
  const [width, setWidth] = useState(0);

  const bounds = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    return {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 1,
      maxY: ys.length ? Math.max(...ys, 1) : 1,
    };
  }, [series]);

  if (series.length === 0) return null;

  const padLeft = 34, padBottom = 20, padTop = 10, padRight = 8;
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = height - padTop - padBottom;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const sx = (x: number) => padLeft + ((x - bounds.minX) / spanX) * plotW;
  const sy = (y: number) => padTop + plotH - (y / bounds.maxY) * plotH;
  const fmtY = yFormat ?? ((v: number) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1)));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={padLeft} x2={width - padRight}
                y1={padTop + plotH * f} y2={padTop + plotH * f}
                stroke={c.border} strokeWidth={1}
              />
            ))}
            {[0, 0.5, 1].map((f) => (
              <SvgText
                key={`y${f}`} x={2} y={padTop + plotH * f + 4}
                fontSize={9} fill={c.textDim}
              >
                {fmtY(bounds.maxY * (1 - f))}
              </SvgText>
            ))}
            {series.map((s) => (
              <Polyline
                key={s.name}
                points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {series.map((s) =>
              s.points.map((p, i) => (
                <Circle key={`${s.name}-${i}`} cx={sx(p.x)} cy={sy(p.y)} r={2.4}
                        fill={s.color} />
              )),
            )}
            <SvgText x={padLeft} y={height - 4} fontSize={9} fill={c.textDim}>
              {bounds.minX}
            </SvgText>
            <SvgText x={width - padRight} y={height - 4} fontSize={9} fill={c.textDim}
                     textAnchor="end">
              {bounds.maxX}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.name} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
              {s.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Prop çubukları: eşiğin üstü yeşil, altı kırmızı, eşik yatay çizgi. */
export interface PropGame {
  label: string;
  value: number;
  opp?: string;
}

export function PropBars({ games, line, height = 170 }:
  { games: PropGame[]; line: number; height?: number }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const max = Math.max(line * 1.15, ...games.map((g) => g.value), 1);

  if (games.length === 0) return null;
  const padBottom = 26, padTop = 8;
  const plot = height - padBottom - padTop;
  const slot = width / games.length;
  const barW = Math.max(3, Math.min(24, slot * 0.66));
  const lineY = padTop + plot - (line / max) * plot;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {games.map((g, i) => {
            const h = (g.value / max) * plot;
            const x = i * slot + (slot - barW) / 2;
            return (
              <Rect
                key={i}
                x={x} y={padTop + plot - h} width={barW} height={Math.max(1, h)}
                rx={2}
                fill={g.value > line ? c.good : c.bad}
                opacity={0.9}
              />
            );
          })}
          <Line x1={0} x2={width} y1={lineY} y2={lineY}
                stroke={c.text} strokeWidth={1.2} strokeDasharray="4 3" />
          <SvgText x={width - 2} y={lineY - 4} fontSize={9} fill={c.text}
                   textAnchor="end">
            {line}
          </SvgText>
          {games.map((g, i) => (
            <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 14}
                     fontSize={8} fill={c.textDim} textAnchor="middle">
              {g.opp ?? ""}
            </SvgText>
          ))}
          {games.map((g, i) => (
            <SvgText key={`w${i}`} x={i * slot + slot / 2} y={height - 3}
                     fontSize={8} fill={c.textDim} textAnchor="middle">
              {g.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** Yatay sıralama çubukları — telefonda dikey çubuktan çok daha okunur:
 *  isim solda tam görünür, çubuk sağa uzar. */
export function RankBars({ rows, height = 22, valueFormat, onPress }: {
  rows: { key: string; label: string; value: number; highlight?: boolean }[];
  height?: number;
  valueFormat?: (v: number) => string;
  onPress?: (key: string) => void;
}) {
  const c = useColors();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const f = valueFormat ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)));

  return (
    <View>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          onPress={onPress ? () => onPress(r.key) : undefined}
          style={styles.rankRow}
        >
          <Text numberOfLines={1}
                style={{ color: c.text, fontSize: font.sm, width: 116 }}>
            {r.label}
          </Text>
          <View style={[styles.rankTrack, { height, backgroundColor: c.bgRaised }]}>
            <View
              style={{
                height,
                width: `${(Math.abs(r.value) / max) * 100}%`,
                backgroundColor: r.highlight ? c.accent : c.link,
                borderRadius: radius.sm,
                opacity: r.highlight ? 1 : 0.85,
              }}
            />
          </View>
          <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700",
                         width: 52, textAlign: "right" }}>
            {f(r.value)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Dağılım grafiği. Telefonda 200 noktayı etiketlemek mümkün değil;
 *  noktaya dokununca kim olduğu altta yazılır. */
export interface ScatterPoint {
  key: string;
  label: string;
  x: number;
  y: number;
}

export function ScatterChart({ points, xLabel, yLabel, height = 260, onSelect }: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
  onSelect?: (p: ScatterPoint) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<ScatterPoint | null>(null);

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    return {
      minX: xs.length ? Math.min(...xs) : 0, maxX: xs.length ? Math.max(...xs) : 1,
      minY: ys.length ? Math.min(...ys) : 0, maxY: ys.length ? Math.max(...ys) : 1,
    };
  }, [points]);

  if (points.length === 0) return null;

  const padLeft = 38, padBottom = 26, padTop = 12, padRight = 12;
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = height - padTop - padBottom;
  const spanX = Math.max(1e-6, bounds.maxX - bounds.minX);
  const spanY = Math.max(1e-6, bounds.maxY - bounds.minY);
  const sx = (x: number) => padLeft + ((x - bounds.minX) / spanX) * plotW;
  const sy = (y: number) => padTop + plotH - ((y - bounds.minY) / spanY) * plotH;

  const nearest = (px: number, py: number): ScatterPoint | null => {
    let best: ScatterPoint | null = null;
    let bestD = Infinity;
    for (const p of points) {
      const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return bestD < 40 ** 2 ? best : null;
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => {
          const p = nearest(e.nativeEvent.locationX, e.nativeEvent.locationY);
          setPicked(p);
          if (p && onSelect) onSelect(p);
        }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={padLeft} x2={width - padRight} y1={padTop + plotH}
                  y2={padTop + plotH} stroke={c.border} strokeWidth={1} />
            <Line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + plotH}
                  stroke={c.border} strokeWidth={1} />
            {points.map((p) => (
              <Circle
                key={p.key}
                cx={sx(p.x)} cy={sy(p.y)} r={picked?.key === p.key ? 6 : 3.4}
                fill={picked?.key === p.key ? c.accent : c.link}
                opacity={picked && picked.key !== p.key ? 0.45 : 0.9}
              />
            ))}
            <SvgText x={2} y={padTop + 8} fontSize={9} fill={c.textDim}>
              {bounds.maxY.toFixed(bounds.maxY < 10 ? 1 : 0)}
            </SvgText>
            <SvgText x={2} y={padTop + plotH} fontSize={9} fill={c.textDim}>
              {bounds.minY.toFixed(bounds.minY < 10 ? 1 : 0)}
            </SvgText>
            <SvgText x={padLeft} y={height - 3} fontSize={9} fill={c.textDim}>
              {bounds.minX.toFixed(bounds.minX < 10 ? 1 : 0)} · {xLabel}
            </SvgText>
            <SvgText x={width - padRight} y={height - 3} fontSize={9} fill={c.textDim}
                     textAnchor="end">
              {bounds.maxX.toFixed(bounds.maxX < 10 ? 1 : 0)}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: space.xs }}>
        {picked ? `${picked.label} · ${xLabel} ${picked.x} · ${yLabel} ${picked.y}` : yLabel}
      </Text>
    </View>
  );
}

/** Karşılaştırma serilerinde kullanılan sabit renk sırası. */
export const SERIES_COLORS = ["#58a6ff", "#f0883e", "#3fb950"];

const styles = StyleSheet.create({
  readout: { height: 22, flexDirection: "row", alignItems: "baseline", gap: 6 },
  legend: {
    flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.xs,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "48%" },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 3,
  },
  rankTrack: { flex: 1, borderRadius: radius.sm, overflow: "hidden" },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
    justifyContent: "center",
  },
  marker: {
    position: "absolute",
    width: 3,
    height: 14,
    borderRadius: 2,
    top: -3,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.xs,
  },
});
