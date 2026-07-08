import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line,
  LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { StatRow } from "../lib/types";
import { fmt, label } from "../lib/columns";

// dataviz paleti — koyu yüzeye (#161b22) karşı doğrulandı (validate_palette.js: ALL PASS)
export const CHART = {
  series1: "#3987e5",
  series2: "#199e70",
  series3: "#c98500",
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  ink: "#e6edf3",
  surface: "#161b22",
};
export const SERIES_COLORS = [CHART.series1, CHART.series2, CHART.series3];

const tooltipStyle = {
  backgroundColor: CHART.surface,
  border: `1px solid ${CHART.axis}`,
  borderRadius: 8,
  color: CHART.ink,
  fontSize: 13,
};

interface WeeklyBarProps {
  rows: StatRow[]; // tek oyuncunun haftalık satırları (week sıralı)
  stat: string;
}

/** Hafta hafta istatistik: sütunlar + 3 haftalık hareketli ortalama eğrisi
    + sezon ortalaması referansı. */
export function WeeklyBarChart({ rows, stat }: WeeklyBarProps) {
  const vals = rows.map((r) => Number(r[stat] ?? 0));
  const data = rows.map((r, i) => {
    const win = vals.slice(Math.max(0, i - 2), i + 1);
    return {
      week: `${r.season_type === "POST" ? "P" : ""}${r.week}`,
      value: vals[i],
      ma: Number((win.reduce((s, v) => s + v, 0) / win.length).toFixed(2)),
    };
  });
  if (data.length === 0) return null;
  const seasonAvg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                       barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="week" tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff10" }}
                   formatter={(v, name) =>
                     [fmt(stat, Number(v)),
                      name === "ma" ? "3 hafta ort." : label(stat)]}
                   labelFormatter={(w) => `Hafta ${w}`} />
          <ReferenceLine y={seasonAvg} stroke={CHART.muted} strokeDasharray="5 5"
                         label={{ value: "sezon ort.", position: "insideTopRight",
                                  fill: CHART.muted, fontSize: 10 }} />
          <Bar dataKey="value" fill={CHART.series1} radius={[4, 4, 0, 0]}
               maxBarSize={28} name={label(stat)} isAnimationActive={false} />
          <Line dataKey="ma" type="monotone" stroke={CHART.series3}
                strokeWidth={2} dot={false} isAnimationActive={false} name="ma" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="chart-note">
        Turuncu eğri 3 haftalık hareketli ortalama; kesikli çizgi sezon ortalaması.
      </p>
    </div>
  );
}

/** Trend durumu: son 3 hafta vs sezon ortalaması. */
export function trendOf(rows: StatRow[], stat: string):
  { kind: "hot" | "cold" | "flat"; recent: number; season: number } {
  const vals = rows
    .filter((r) => r.season_type === "REG")
    .map((r) => Number(r[stat] ?? 0));
  const season = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const last3 = vals.slice(-3);
  const recent = last3.length ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
  if (vals.length < 5 || season === 0)
    return { kind: "flat", recent, season };
  const ratio = recent / season;
  return { kind: ratio >= 1.25 ? "hot" : ratio <= 0.75 ? "cold" : "flat",
           recent, season };
}

export interface CompareSeries {
  name: string;
  rows: StatRow[]; // haftalık satırlar (week alanlı)
}

/** Birden çok oyuncunun aynı istatistiğini hafta bazında üst üste çizer. */
export function CompareLineChart({ series, stat }:
  { series: CompareSeries[]; stat: string }) {
  const weeks = [...new Set(series.flatMap((s) => s.rows.map((r) => Number(r.week))))]
    .sort((a, b) => a - b);
  const data = weeks.map((w) => {
    const point: Record<string, number | null> = { week: w };
    for (const s of series) {
      const row = s.rows.find((r) => Number(r.week) === w);
      point[s.name] = row ? Number(row[stat] ?? 0) : null;
    }
    return point;
  });
  if (weeks.length === 0) return null;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="week" tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{
                     backgroundColor: CHART.surface, border: `1px solid ${CHART.axis}`,
                     borderRadius: 8, color: CHART.ink, fontSize: 13,
                   }}
                   labelFormatter={(w) => `Hafta ${w}`}
                   formatter={(v, name) => [fmt(stat, Number(v)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART.ink }} />
          {series.map((s, i) => (
            <Line key={s.name} dataKey={s.name} type="monotone" connectNulls
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2}
                  dot={{ r: 3, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Genel amaçlı dağılım grafiği: x/y istatistik, isim etiketli, tıklanabilir. */
export function PlayerScatterChart({ rows, x, y, labelTop = 12, nameKey = "player_name",
                                     idKey = "player_id", onPointClick, highlight }: {
  rows: StatRow[]; x: string; y: string; labelTop?: number;
  nameKey?: string; idKey?: string;
  onPointClick?: (id: string) => void;
  /** arama vurgusu: isim bu sorguyu içeriyorsa turuncu + etiketli gösterilir */
  highlight?: string;
}) {
  const q = (highlight ?? "").trim().toLowerCase();
  const all = rows
    .filter((r) => typeof r[x] === "number" && typeof r[y] === "number")
    .map((r) => ({ name: String(r[nameKey]), id: String(r[idKey] ?? ""),
                   xv: Number(r[x]), yv: Number(r[y]) }));
  if (all.length === 0) return null;
  const hits = q ? all.filter((d) => d.name.toLowerCase().includes(q)) : [];
  const hitSet = new Set(hits.map((d) => d.name));
  const data = all.filter((d) => !hitSet.has(d.name));
  const top = [...data].sort((a, b) => b.yv - a.yv).slice(0, labelTop);
  const topSet = new Set(top.map((d) => d.name));
  const rest = data.filter((d) => !topSet.has(d.name));

  // lig ortalamaları + en küçük kareler trend doğrusu + korelasyon
  const n = all.length;
  const meanX = all.reduce((s, d) => s + d.xv, 0) / n;
  const meanY = all.reduce((s, d) => s + d.yv, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const d of all) {
    sxx += (d.xv - meanX) ** 2;
    sxy += (d.xv - meanX) * (d.yv - meanY);
    syy += (d.yv - meanY) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const xMin = Math.min(...all.map((d) => d.xv));
  const xMax = Math.max(...all.map((d) => d.xv));
  const trend = n >= 8 && Math.abs(corr) >= 0.2
    ? { x1: xMin, y1: meanY + slope * (xMin - meanX),
        x2: xMax, y2: meanY + slope * (xMax - meanX) }
    : null;
  const handleClick = onPointClick
    ? (d: unknown) => {
        const p = (d as { payload?: { id?: string } })?.payload
          ?? (d as { id?: string });
        if (p?.id) onPointClick(p.id);
      }
    : undefined;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={460}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: -4 }}>
          <CartesianGrid stroke={CHART.grid} />
          <XAxis dataKey="xv" type="number" domain={["auto", "auto"]}
                 tick={{ fill: CHART.muted, fontSize: 11 }}
                 tickFormatter={(v) => fmt(x, Number(v))}
                 axisLine={{ stroke: CHART.axis }} tickLine={false}
                 label={{ value: label(x), position: "insideBottom", offset: -4,
                          fill: CHART.muted, fontSize: 12 }} />
          <YAxis dataKey="yv" type="number" domain={["auto", "auto"]} width={64}
                 tick={{ fill: CHART.muted, fontSize: 11 }}
                 tickFormatter={(v) => fmt(y, Number(v))}
                 axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{
                     backgroundColor: CHART.surface, border: `1px solid ${CHART.axis}`,
                     borderRadius: 8, color: CHART.ink, fontSize: 13,
                   }}
                   cursor={{ stroke: CHART.muted }}
                   formatter={(v, name) =>
                     [fmt(name === "xv" ? x : y, Number(v)),
                      name === "xv" ? label(x) : label(y)]}
                   labelFormatter={() => ""}
                   content={undefined} />
          <ReferenceLine x={meanX} stroke={CHART.axis} strokeDasharray="5 5"
                         label={{ value: "lig ort.", position: "insideTopLeft",
                                  fill: CHART.muted, fontSize: 10 }} />
          <ReferenceLine y={meanY} stroke={CHART.axis} strokeDasharray="5 5" />
          {trend && (
            <ReferenceLine segment={[{ x: trend.x1, y: trend.y1 },
                                     { x: trend.x2, y: trend.y2 }]}
                           stroke={CHART.series2} strokeWidth={1.5}
                           strokeDasharray="7 4" ifOverflow="hidden" />
          )}
          <Scatter data={rest} fill={CHART.series1} isAnimationActive={false}
                   onClick={handleClick}
                   cursor={onPointClick ? "pointer" : undefined} />
          <Scatter data={top} fill={CHART.series1} isAnimationActive={false}
                   onClick={handleClick}
                   cursor={onPointClick ? "pointer" : undefined}>
            <LabelList dataKey="name" position="top"
                       style={{ fill: CHART.ink, fontSize: 11 }} />
          </Scatter>
          {hits.length > 0 && (
            <Scatter data={hits} fill={CHART.series3} isAnimationActive={false}
                     onClick={handleClick}
                     cursor={onPointClick ? "pointer" : undefined}
                     shape={(props: unknown) => {
                       const { cx, cy } = props as { cx: number; cy: number };
                       return (
                         <g>
                           <circle cx={cx} cy={cy} r={9} fill="none"
                                   stroke={CHART.series3} strokeWidth={2} />
                           <circle cx={cx} cy={cy} r={4.5} fill={CHART.series3} />
                         </g>
                       );
                     }}>
              <LabelList dataKey="name" position="top"
                         style={{ fill: CHART.series3, fontSize: 12, fontWeight: 700 }} />
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <p className="chart-note">
        Kesikli gri çizgiler lig ortalaması{trend
          ? `; yeşil kesikli çizgi eğilim doğrusu (korelasyon r=${corr.toFixed(2)} — ` +
            `${Math.abs(corr) >= 0.7 ? "güçlü" : Math.abs(corr) >= 0.4 ? "orta" : "zayıf"} ilişki)`
          : ""}.
        {onPointClick ? " Bir noktaya tıklayınca künye açılır." : ""}
      </p>
    </div>
  );
}

/** Yatay bar sıralaması: seçilen metrikte en iyiler, isim etiketli. */
export function BarRankingChart({ rows, metric, nameKey = "player_name",
                                  idKey = "player_id", count = 20,
                                  onPointClick, highlight }: {
  rows: StatRow[]; metric: string; nameKey?: string; idKey?: string;
  count?: number; onPointClick?: (id: string) => void; highlight?: string;
}) {
  const q = (highlight ?? "").trim().toLowerCase();
  const data = rows
    .filter((r) => typeof r[metric] === "number")
    .map((r) => ({ name: String(r[nameKey]), id: String(r[idKey] ?? ""),
                   value: Number(r[metric]) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
  if (data.length === 0) return null;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28 + 40)}>
        <BarChart data={data} layout="vertical"
                  margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" tick={{ fill: CHART.muted, fontSize: 11 }}
                 tickFormatter={(v) => fmt(metric, Number(v))}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150}
                 tick={{ fill: CHART.ink, fontSize: 12 }}
                 axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{
                     backgroundColor: CHART.surface, border: `1px solid ${CHART.axis}`,
                     borderRadius: 8, color: CHART.ink, fontSize: 13,
                   }}
                   cursor={{ fill: "#ffffff10" }}
                   formatter={(v) => [fmt(metric, Number(v)), label(metric)]} />
          <Bar dataKey="value" isAnimationActive={false} maxBarSize={18}
               radius={[0, 4, 4, 0]}
               onClick={onPointClick ? (d: unknown) => {
                 const p = (d as { payload?: { id?: string } })?.payload
                   ?? (d as { id?: string });
                 if (p?.id) onPointClick(p.id);
               } : undefined}
               cursor={onPointClick ? "pointer" : undefined}>
            {data.map((d) => (
              <Cell key={d.name}
                    fill={q && d.name.toLowerCase().includes(q)
                          ? CHART.series3 : CHART.series1} />
            ))}
            <LabelList dataKey="value" position="right"
                       formatter={((v: unknown) =>
                         fmt(metric, Number(v))) as never}
                       style={{ fill: CHART.muted, fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TeamScatterProps {
  rows: StatRow[]; // team_season satırları
  highlight?: string;
}

/** Lig geneli: atılan sayı (x) vs yenilen sayı (y) — takım etiketli scatter. */
export function TeamScatterChart({ rows, highlight }: TeamScatterProps) {
  const data = rows
    .filter((r) => r.points_for !== null && r.points_against !== null)
    .map((r) => ({
      team: String(r.team),
      pf: Number(r.points_for),
      pa: Number(r.points_against),
    }));
  if (data.length === 0) return null;
  const avgPf = data.reduce((s, d) => s + d.pf, 0) / data.length;
  const avgPa = data.reduce((s, d) => s + d.pa, 0) / data.length;

  return (
    <div className="chart-box">
      <p className="chart-note">
        x: atılan sayı, y: yenilen sayı (ters çevrilmiş) — sağ üst köşe ideal:
        çok sayı atıp az sayı yiyen takımlar. Kesikli çizgiler lig ortalaması.
      </p>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 8, left: -8 }}>
          <CartesianGrid stroke={CHART.grid} />
          <XAxis dataKey="pf" type="number" domain={["auto", "auto"]}
                 name="Atılan Sayı"
                 tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={{ stroke: CHART.axis }} tickLine={false}
                 label={{ value: "Atılan Sayı", position: "insideBottom",
                          offset: -4, fill: CHART.muted, fontSize: 12 }} />
          <YAxis dataKey="pa" type="number" domain={["auto", "auto"]} reversed
                 name="Yenilen Sayı" width={48}
                 tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={false} tickLine={false} />
          <ReferenceLine x={avgPf} stroke={CHART.axis} strokeDasharray="4 4" />
          <ReferenceLine y={avgPa} stroke={CHART.axis} strokeDasharray="4 4" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: CHART.muted }}
                   formatter={(v, name) =>
                     [String(v), name === "pf" ? "Atılan Sayı" : "Yenilen Sayı"]}
                   labelFormatter={() => ""} />
          <Scatter data={data} fill={CHART.series1}>
            <LabelList dataKey="team" position="top"
                       style={{ fill: CHART.ink, fontSize: 11 }} />
          </Scatter>
          {highlight && (
            <Scatter data={data.filter((d) => d.team === highlight)}
                     fill={CHART.series2} shape="circle" />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
