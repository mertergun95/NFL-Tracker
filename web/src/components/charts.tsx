import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis,
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

/** Oyuncunun hafta hafta tek istatistiği — sütun grafiği. */
export function WeeklyBarChart({ rows, stat }: WeeklyBarProps) {
  const data = rows.map((r) => ({
    week: `${r.season_type === "POST" ? "P" : ""}${r.week}`,
    value: Number(r[stat] ?? 0),
  }));
  if (data.length === 0) return null;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                  barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="week" tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis tick={{ fill: CHART.muted, fontSize: 11 }}
                 axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff10" }}
                   formatter={(v) => [fmt(stat, Number(v)), label(stat)]}
                   labelFormatter={(w) => `Hafta ${w}`} />
          <Bar dataKey="value" fill={CHART.series1} radius={[4, 4, 0, 0]}
               maxBarSize={28} name={label(stat)} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
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
                                     idKey = "player_id", onPointClick }: {
  rows: StatRow[]; x: string; y: string; labelTop?: number;
  nameKey?: string; idKey?: string;
  onPointClick?: (id: string) => void;
}) {
  const data = rows
    .filter((r) => typeof r[x] === "number" && typeof r[y] === "number")
    .map((r) => ({ name: String(r[nameKey]), id: String(r[idKey] ?? ""),
                   xv: Number(r[x]), yv: Number(r[y]) }));
  if (data.length === 0) return null;
  const top = [...data].sort((a, b) => b.yv - a.yv).slice(0, labelTop);
  const topSet = new Set(top.map((d) => d.name));
  const rest = data.filter((d) => !topSet.has(d.name));
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
          <Scatter data={rest} fill={CHART.series1} isAnimationActive={false}
                   onClick={handleClick}
                   cursor={onPointClick ? "pointer" : undefined} />
          <Scatter data={top} fill={CHART.series1} isAnimationActive={false}
                   onClick={handleClick}
                   cursor={onPointClick ? "pointer" : undefined}>
            <LabelList dataKey="name" position="top"
                       style={{ fill: CHART.ink, fontSize: 11 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {onPointClick && (
        <p className="chart-note">Bir noktaya tıklayınca oyuncu künyesi açılır.</p>
      )}
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
