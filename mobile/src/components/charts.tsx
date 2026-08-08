/** Hafif grafikler — SVG ile elle çizilir.
 *
 *  Web'de recharts var; mobilde tam bir grafik kütüphanesi taşımak hem
 *  paketi büyütür hem de burada gerekenler basit: hafta hafta bir çubuk
 *  serisi ve taban–tavan bandı. İkisi de doğrudan react-native-svg ile
 *  çiziliyor, ek bağımlılık yok.
 */
import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { font, radius, space, useColors } from "../lib/theme";

export interface BarPoint {
  label: string;
  value: number;
  /** Vurgulanacak çubuk (ör. playoff haftası). */
  highlight?: boolean;
}

/** Hafta hafta çubuk grafiği (maç logu görselleştirmesi). */
export function WeekBars({ data, height = 150, valueFormat }:
  { data: BarPoint[]; height?: number; valueFormat?: (v: number) => string }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.abs(d.value))),
    [data],
  );

  if (data.length === 0) return null;

  const padBottom = 18;
  const padTop = 14;
  const plot = height - padBottom - padTop;
  const slot = width / data.length;
  const barW = Math.max(3, Math.min(26, slot * 0.62));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* taban çizgisi */}
          <Line
            x1={0} y1={padTop + plot} x2={width} y2={padTop + plot}
            stroke={c.border} strokeWidth={1}
          />
          {data.map((d, i) => {
            const h = (Math.abs(d.value) / max) * plot;
            const x = i * slot + (slot - barW) / 2;
            const y = padTop + plot - h;
            return (
              <Rect
                key={i}
                x={x} y={y} width={barW} height={Math.max(1, h)}
                rx={2}
                fill={d.highlight ? c.accent : c.link}
                opacity={d.highlight ? 1 : 0.85}
              />
            );
          })}
          {data.map((d, i) => (
            <SvgText
              key={`l${i}`}
              x={i * slot + slot / 2}
              y={height - 5}
              fontSize={9}
              fill={c.textDim}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          ))}
          <SvgText x={2} y={10} fontSize={9} fill={c.textDim}>
            {valueFormat ? valueFormat(max) : String(Math.round(max))}
          </SvgText>
        </Svg>
      ) : null}
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

const styles = StyleSheet.create({
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
