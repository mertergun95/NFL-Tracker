/**
 * Pieces shared by more than one bet tracker screen: the bankroll scope
 * switcher, the bookmaker mark, the saved-bet card, and the equity curve.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Line as SvgLine } from 'react-native-svg';
import { font, radius, space, useColors } from '../lib/theme';
import { useI18n } from './i18n';
import { formatOdds } from './core/odds';
import {
  combinedOdds,
  isBuilder,
  pickStatus,
  potentialReturn,
  settleBet,
  SETTLEABLE_STATUSES,
  withLegStatus,
  withPickStatus,
} from './core/settlement';
import { sportIcon } from './core/reference';
import type { CurvePoint } from './core/stats';
import type { Bet, BetStatus, OddsFormat, Selection, SelectionStatus } from './core/types';
import { useApp } from './state/AppContext';
import { Badge, Dim, Row, Sheet } from './ui';

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
 * Bookmaker mark
 * ------------------------------------------------------------------ */

/**
 * Colour for a bookmaker's mark, derived from its name.
 *
 * Deliberately not the real brand colours, and deliberately initials rather
 * than logos: this app already draws teams as an abbreviation on a generated
 * colour when images are off, precisely so nothing in the bundle carries a
 * third party's marks. A bookmaker mark plays by the same rule. The hash keeps
 * a given book the same colour everywhere, which is what makes it scannable in
 * a list.
 */
function bookmakerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 52%, 42%)`;
}

/** Up to two letters: "Bet365" → "B3", "Nesine" → "NE". */
function bookmakerInitials(name: string): string {
  const words = name.trim().split(/[\s./-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length > 1) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  const word = words[0]!;
  const digit = word.match(/\d/);
  return (word[0]! + (digit ? digit[0] : (word[1] ?? ''))).toUpperCase();
}

export function BookmakerBadge({ name, size = 22 }: { name: string; size?: number }) {
  if (!name.trim()) return null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: bookmakerColor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '800' }}>
        {bookmakerInitials(name)}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Status colours
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

/** Chip colour for one outcome. Shared with the bet form. */
export function legTone(status: SelectionStatus): 'good' | 'bad' | 'warn' | 'dim' {
  if (status === 'won' || status === 'half_won') return 'good';
  if (status === 'lost' || status === 'half_lost') return 'bad';
  if (status === 'pending') return 'warn';
  return 'dim';
}

/* ------------------------------------------------------------------ *
 * Saved bet card
 * ------------------------------------------------------------------ */

/**
 * A saved bet in a list.
 *
 * Tapping the card opens its legs in place, and each leg's outcome is set from
 * the card itself. Settling a bet is the thing this app does most often, and
 * routing that through the full edit form — nine fields, a save button, a
 * screen transition — made the common case the slowest one. The edit form is
 * still there behind the ⋮ menu for everything else.
 *
 * The status also drives a colour bar down the left edge, so a list of bets
 * can be read at a glance without stopping to read each chip.
 */
export function BetCard({
  bet,
  oddsFormat,
  onEdit,
  onDelete,
  selected,
  onToggleSelect,
  /** Collapsed cards only; the dashboard shows summaries, not controls. */
  expandable = true,
}: {
  bet: Bet;
  oddsFormat: OddsFormat;
  onEdit?: () => void;
  onDelete?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  expandable?: boolean;
}) {
  const c = useColors();
  const { t, formatMoney, formatDate } = useI18n();
  const { currency, updateBets } = useApp();

  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const settlement = useMemo(() => settleBet(bet), [bet]);
  const tone = STATUS_TONE[settlement.status];
  const barColor =
    tone === 'good' ? c.good : tone === 'bad' ? c.bad : tone === 'warn' ? c.warn : c.border;

  const first = bet.selections[0];
  const extra = bet.selections.length - 1;

  // An open bet shows what it would return, not a zeroed-out profit: until it
  // settles, `settleBet` reports 0 returned, and subtracting the stake from
  // that reads as a loss the user has not taken.
  const amount = settlement.settled
    ? settlement.profit
    : potentialReturn(bet) - settlement.totalStake;

  const amountColor = !settlement.settled
    ? c.textDim
    : settlement.profit > 0
      ? c.good
      : settlement.profit < 0
        ? c.bad
        : c.textDim;

  /**
   * Writes one leg back, leaving the others alone.
   *
   * Reopening a leg has to drop `settledAt` too, or the bet keeps a settlement
   * date it no longer has and the equity curve orders it by that date.
   */
  function replaceLeg(next: Selection) {
    const selections = bet.selections.map((s) => (s.id === next.id ? next : s));
    void updateBets([bet.id], {
      selections,
      settledAt: selections.some((s) => s.status === 'pending')
        ? undefined
        : (bet.settledAt ?? Date.now()),
    });
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: c.bgSoft,
        borderRadius: radius.md,
        marginBottom: space.sm,
        overflow: 'hidden',
      }}
    >
      {/* Durum çubuğu: listeyi okumadan tarayabilmek için. */}
      <View style={{ width: 4, backgroundColor: barColor }} />

      <View style={{ flex: 1, padding: space.md }}>
        <Pressable
          onPress={() => (expandable ? setOpen((v) => !v) : onEdit?.())}
          onLongPress={onToggleSelect}
        >
          <Row gap={space.sm}>
            <Text style={{ fontSize: font.md }}>{sportIcon(first?.sport ?? '')}</Text>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: font.md,
                                             fontWeight: '600', flex: 1 }}>
              {first?.event || t('bet.bet')}
              {extra > 0 ? ` +${extra}` : ''}
            </Text>
            <Badge label={statusLabel(settlement.status, t)} tone={tone} />
            {onEdit || onDelete ? (
              <Pressable onPress={() => setMenu(true)} hitSlop={12}
                         style={{ paddingHorizontal: 4 }}>
                <Text style={{ color: c.textDim, fontSize: font.lg, fontWeight: '700' }}>⋮</Text>
              </Pressable>
            ) : null}
          </Row>

          <Row gap={space.md} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
            <BookmakerBadge name={bet.bookmaker} size={20} />
            <Dim style={{ fontSize: font.xs }}>{formatDate(bet.placedAt)}</Dim>
            <Dim style={{ fontSize: font.xs }}>
              {formatOdds(combinedOdds(bet), oddsFormat)}
            </Dim>
            <Dim style={{ fontSize: font.xs }}>
              {formatMoney(settlement.totalStake, currency)}
            </Dim>
            <View style={{ flex: 1 }} />
            <Text style={{ color: amountColor, fontSize: font.md, fontWeight: '700' }}>
              {settlement.settled
                ? formatMoney(amount, currency, { sign: true })
                : `→ ${formatMoney(amount, currency, { sign: true })}`}
            </Text>
          </Row>

          {expandable ? (
            <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: space.xs,
                           textAlign: 'center' }}>
              {open ? '▲' : `▼  ${bet.selections.length} ${t('bet.selections')}`}
            </Text>
          ) : null}
        </Pressable>

        {open ? (
          <View style={{ marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth,
                         borderTopColor: c.border, paddingTop: space.sm }}>
            {bet.selections.map((selection) => (
              <LegRow
                key={selection.id}
                selection={selection}
                oddsFormat={oddsFormat}
                onChange={replaceLeg}
              />
            ))}
          </View>
        ) : null}
      </View>

      <Sheet open={menu} onClose={() => setMenu(false)} title={first?.event || t('bet.bet')}>
        {onEdit ? (
          <MenuItem
            label={t('action.edit')}
            glyph="✎"
            onPress={() => {
              setMenu(false);
              onEdit();
            }}
          />
        ) : null}
        {onDelete ? (
          <MenuItem
            label={t('action.delete')}
            glyph="🗑"
            danger
            onPress={() => {
              setMenu(false);
              onDelete();
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

function MenuItem({
  label,
  glyph,
  onPress,
  danger,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: font.lg }}>{glyph}</Text>
      <Text style={{ color: danger ? c.bad : c.text, fontSize: font.md, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One leg inside an expanded card.
 *
 * A bet builder is a single price on several predictions, so each prediction
 * gets its own outcome buttons and the leg's status is read off them. Settling
 * the whole leg in one tap would throw away exactly the detail the analyser
 * needs — which of the four calls actually landed.
 */
function LegRow({
  selection,
  oddsFormat,
  onChange,
}: {
  selection: Selection;
  oddsFormat: OddsFormat;
  onChange: (selection: Selection) => void;
}) {
  const c = useColors();
  const { t } = useI18n();

  const builder = isBuilder(selection);
  const picks = selection.picks.map((p) => p.pick).filter(Boolean).join(' + ');
  const markets = selection.picks.map((p) => p.market).filter(Boolean).join(' + ');

  return (
    <View style={{ marginBottom: space.md }}>
      <Row gap={space.sm}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm,
                                         fontWeight: '600', flex: 1 }}>
          {selection.event || '—'}
        </Text>
        <Text style={{ color: c.textDim, fontSize: font.sm }}>
          {formatOdds(selection.odds, oddsFormat)}
        </Text>
      </Row>

      {builder ? (
        <>
          {/* Ayağın kendi sonucu tahminlerden çıkıyor; elle seçilmiyor. */}
          <Row gap={space.sm} style={{ marginTop: 2 }}>
            <Dim style={{ fontSize: font.xs, flex: 1 }}>
              {t('bet.builder')} ×{selection.picks.length} · {t('bet.builder.perPick')}
            </Dim>
            <Badge label={t(`status.${selection.status}` as never)}
                   tone={legTone(selection.status)} />
          </Row>

          {selection.picks.map((pick) => (
            <PickRow
              key={pick.id}
              label={pick.pick || pick.market || '—'}
              sub={pick.pick && pick.market ? pick.market : ''}
              status={pickStatus(selection, pick)}
              onSetStatus={(status) => onChange(withPickStatus(selection, pick.id, status))}
            />
          ))}
        </>
      ) : (
        <>
          {picks ? (
            <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: 2 }}>
              {markets ? `${markets} · ` : ''}{picks}
            </Text>
          ) : null}

          <StatusChips
            status={selection.status}
            onSetStatus={(status) => onChange(withLegStatus(selection, status))}
          />
        </>
      )}
    </View>
  );
}

/** One prediction of a bet builder, with its own outcome buttons. */
function PickRow({
  label,
  sub,
  status,
  onSetStatus,
}: {
  label: string;
  sub: string;
  status: SelectionStatus;
  onSetStatus: (status: SelectionStatus) => void;
}) {
  const c = useColors();

  return (
    <View style={{ marginTop: space.sm, paddingLeft: space.sm,
                   borderLeftWidth: 2, borderLeftColor: c.border }}>
      <Text numberOfLines={2} style={{ color: c.text, fontSize: font.xs, fontWeight: '600' }}>
        {label}
      </Text>
      {sub ? <Dim style={{ fontSize: font.xs }}>{sub}</Dim> : null}
      <StatusChips status={status} onSetStatus={onSetStatus} />
    </View>
  );
}

/**
 * The outcome buttons. Half-won / half-lost are deliberately absent: they only
 * apply to Asian quarter lines, which this app's sports do not have, and they
 * were pushing the outcomes people do use onto a second row.
 */
function StatusChips({
  status,
  onSetStatus,
}: {
  status: SelectionStatus;
  onSetStatus: (status: SelectionStatus) => void;
}) {
  const c = useColors();
  const { t } = useI18n();

  return (
    <Row gap={6} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
      {SETTLEABLE_STATUSES.map((option) => {
        const active = status === option;
        const tone = legTone(option);
        const fg = tone === 'good' ? c.good : tone === 'bad' ? c.bad
          : tone === 'warn' ? c.warn : c.textDim;

        return (
          <Pressable
            key={option}
            onPress={() => onSetStatus(option)}
            style={{
              paddingHorizontal: space.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? fg : c.border,
              backgroundColor: active ? fg : 'transparent',
            }}
          >
            <Text style={{ color: active ? c.bg : fg, fontSize: font.xs,
                           fontWeight: active ? '800' : '600' }}>
              {t(`status.${option}` as never)}
            </Text>
          </Pressable>
        );
      })}
    </Row>
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
