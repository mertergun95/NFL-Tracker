/**
 * Pieces shared by more than one bet tracker screen: the bankroll scope
 * switcher, the bet row, and the equity curve.
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path, Line as SvgLine } from 'react-native-svg';
import { font, radius, space, useColors } from '../lib/theme';
import { useI18n } from './i18n';
import { formatOdds } from './core/odds';
import { combinedOdds, settleBet } from './core/settlement';
import { sportIcon } from './core/reference';
import type { CurvePoint } from './core/stats';
import type { Bet, BetStatus, OddsFormat } from './core/types';
import { useApp } from './state/AppContext';
import { Badge, Dim, Row } from './ui';

/* ------------------------------------------------------------------ *
 * Bankroll scope
 * ------------------------------------------------------------------ */

/** Chip row that scopes every screen to one bankroll, or to all of them. */
export function BankrollSwitcher() {
  const c = useColors();
  const { t } = useI18n();
  const { bankrolls, activeBankrollId, setActiveBankrollId } = useApp();

  const live = bankrolls.filter((b) => !b.archived);
  if (live.length < 2) return null;

  const options = [
    { id: null as string | null, label: t('bankroll.allBankrolls'), color: c.textDim },
    ...live.map((b) => ({ id: b.id as string | null, label: b.name, color: b.color })),
  ];

  return (
    <Row gap={space.sm} style={{ flexWrap: 'wrap', marginBottom: space.md }}>
      {options.map((o) => {
        const active = o.id === activeBankrollId;
        return (
          <Pressable
            key={o.id ?? 'all'}
            onPress={() => setActiveBankrollId(o.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: space.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? c.accent : c.border,
              backgroundColor: active ? c.accent : c.bgSoft,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.color }} />
            <Text style={{ color: active ? c.accentText : c.text, fontSize: font.xs,
                           fontWeight: active ? '700' : '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/* ------------------------------------------------------------------ *
 * Bet row
 * ------------------------------------------------------------------ */

const STATUS_TONE: Record<BetStatus, 'good' | 'bad' | 'warn' | 'dim'> = {
  won: 'good',
  lost: 'bad',
  pending: 'warn',
  partial: 'warn',
  cashed_out: 'good',
  void: 'dim',
};

export function statusLabel(status: BetStatus, t: (k: never) => string): string {
  // `cashed_out` shares the "won" chip: the dictionary has no separate string
  // for it and the money already tells the user it was cashed out.
  const key = status === 'cashed_out' ? 'status.won' : `status.${status}`;
  return t(key as never);
}

export function BetRow({
  bet,
  oddsFormat,
  onPress,
  selected,
  onToggleSelect,
}: {
  bet: Bet;
  oddsFormat: OddsFormat;
  onPress?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const c = useColors();
  const { t, formatMoney, formatDate } = useI18n();
  const { currency } = useApp();
  const settlement = useMemo(() => settleBet(bet), [bet]);

  const first = bet.selections[0];
  const extra = bet.selections.length - 1;
  const picks = first?.picks.map((p) => p.pick).filter(Boolean).join(' + ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onToggleSelect}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: c.bgSoft,
        borderRadius: radius.md,
        padding: space.md,
        marginBottom: space.sm,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Row gap={space.sm}>
        <Text style={{ fontSize: font.md }}>{sportIcon(first?.sport ?? '')}</Text>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.md,
                                         fontWeight: '600', flex: 1 }}>
          {first?.event || t('bet.bet')}
          {extra > 0 ? ` +${extra}` : ''}
        </Text>
        <Badge label={statusLabel(settlement.status, t)} tone={STATUS_TONE[settlement.status]} />
      </Row>

      {picks ? (
        <Dim style={{ marginTop: 2 }} >{picks}</Dim>
      ) : null}

      <Row gap={space.md} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
        <Dim style={{ fontSize: font.xs }}>{formatDate(bet.placedAt)}</Dim>
        <Dim style={{ fontSize: font.xs }}>
          {formatOdds(combinedOdds(bet), oddsFormat)}
        </Dim>
        <Dim style={{ fontSize: font.xs }}>
          {formatMoney(settlement.totalStake, currency)}
        </Dim>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            color: !settlement.settled ? c.textDim
              : settlement.profit > 0 ? c.good
              : settlement.profit < 0 ? c.bad
              : c.textDim,
            fontSize: font.md,
            fontWeight: '700',
          }}
        >
          {settlement.settled
            ? formatMoney(settlement.profit, currency, { sign: true })
            : `→ ${formatMoney(settlement.returned || bet.unitStake * combinedOdds(bet), currency)}`}
        </Text>
      </Row>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Equity curve
 * ------------------------------------------------------------------ */

/**
 * Cumulative profit as a filled area.
 *
 * Drawn directly with `react-native-svg` rather than through a chart library:
 * one series, no interaction, and the app already depends on svg for the
 * stats charts.
 */
export function EquityChart({
  points,
  mode = 'profit',
  height = 160,
}: {
  points: CurvePoint[];
  mode?: 'profit' | 'balance';
  height?: number;
}) {
  const c = useColors();
  const { t } = useI18n();
  // The drawing width is only known after layout, so the first pass measures
  // and the second draws.
  const [width, setWidth] = useState(0);

  const values = points.map((p) => (mode === 'profit' ? p.profit : p.balance));

  if (values.length < 2 || width === 0) {
    return (
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        {values.length < 2 ? <Dim>{t('dash.noData')}</Dim> : null}
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat line would divide by zero; give it a band so it renders mid-height.
  const span = max - min || Math.abs(max) || 1;
  const pad = 6;

  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  const last = values[values.length - 1] ?? 0;
  const stroke = last >= 0 ? c.good : c.bad;
  const zeroY = min <= 0 && max >= 0 ? y(0) : null;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      <Svg width={width} height={height}>
        {zeroY !== null ? (
          <SvgLine x1={0} y1={zeroY} x2={width} y2={zeroY}
                   stroke={c.border} strokeWidth={1} strokeDasharray="3 3" />
        ) : null}
        <Path d={area} fill={stroke} fillOpacity={0.12} />
        <Path d={line} stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
