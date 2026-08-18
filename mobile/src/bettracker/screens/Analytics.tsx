import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { font, space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import { formatOdds } from '../core/odds';
import {
  breakdownBy,
  computePickStats,
  computeStats,
  monthlyBreakdown,
  oddsBand,
  pickBreakdownBy,
  weekdayBreakdown,
  type BreakdownRow,
  type PickBreakdownRow,
} from '../core/stats';
import type { Bet } from '../core/types';
import { useApp } from '../state/AppContext';
import { BankrollSwitcher } from '../components';
import { Chips, Dim, Panel, Row, Stat, StatGrid } from '../ui';

type Dimension =
  | 'sport'
  | 'competition'
  | 'bookmaker'
  | 'tipster'
  | 'structure'
  | 'tag'
  | 'odds'
  | 'weekday'
  | 'month';

/** Where the money actually came from, cut by whichever dimension is selected. */
export default function Analytics() {
  const { t, formatMoney, formatPercent, formatNumber } = useI18n();
  const { settings, scopedBets, currency } = useApp();

  const [dimension, setDimension] = useState<Dimension>('sport');
  const [pickDimension, setPickDimension] = useState<'market' | 'pick'>('market');

  const stats = useMemo(() => computeStats(scopedBets), [scopedBets]);
  const rows = useMemo(
    () => breakdown(scopedBets, dimension, t),
    [scopedBets, dimension, t],
  );

  /**
   * Prediction-level figures.
   *
   * A bet builder is one price on several predictions, so bet-level numbers can
   * only say the whole thing lost — not that three of its four calls were
   * right. These count the predictions one by one.
   */
  const pickStats = useMemo(() => computePickStats(scopedBets), [scopedBets]);
  const pickRows = useMemo(
    () =>
      pickDimension === 'market'
        ? pickBreakdownBy(scopedBets, (p) => p.pick.market || t('common.unknown'))
        : pickBreakdownBy(scopedBets, (p) => p.pick.pick || p.pick.market || t('common.unknown')),
    [scopedBets, pickDimension, t],
  );

  if (scopedBets.length === 0) {
    return (
      <View>
        <BankrollSwitcher />
        <Dim style={{ textAlign: 'center', paddingVertical: space.xxl }}>
          {t('analytics.noData')}
        </Dim>
      </View>
    );
  }

  return (
    <View>
      <BankrollSwitcher />

      <Panel title={t('analytics.overview')}>
        <StatGrid>
          <Stat
            label={t('stat.profit')}
            value={formatMoney(stats.profit, currency, { sign: true })}
            tone={stats.profit > 0 ? 'good' : stats.profit < 0 ? 'bad' : undefined}
          />
          <Stat label={t('stat.yield')} value={formatPercent(stats.yield)} />
          <Stat label={t('stat.hitRate')} value={formatPercent(stats.hitRate)} />
          <Stat label={t('stat.turnover')} value={formatMoney(stats.turnover, currency)} />
          <Stat label={t('stat.avgStake')} value={formatMoney(stats.avgStake, currency)} />
          <Stat
            label={t('stat.avgOdds')}
            value={formatOdds(stats.avgOdds, settings.oddsFormat)}
          />
          <Stat label={t('stat.profitFactor')} value={formatNumber(stats.profitFactor, {
            maximumFractionDigits: 2,
          })} />
          <Stat
            label={t('stat.maxDrawdown')}
            value={formatMoney(stats.maxDrawdown, currency)}
            sub={formatPercent(stats.maxDrawdownPct)}
          />
          <Stat
            label={t('stat.biggestWin')}
            value={formatMoney(stats.biggestWin, currency)}
            tone="good"
          />
          <Stat
            label={t('stat.biggestLoss')}
            value={formatMoney(stats.biggestLoss, currency)}
            tone="bad"
          />
          <Stat label={t('stat.longestWinStreak')} value={String(stats.longestWinStreak)} />
          <Stat label={t('stat.longestLossStreak')} value={String(stats.longestLossStreak)} />
        </StatGrid>
      </Panel>

      {stats.clvBetCount > 0 ? (
        <Panel title={t('clv.title')}>
          <Dim style={{ marginBottom: space.sm }}>{t('clv.explain')}</Dim>
          <StatGrid>
            <Stat
              label={t('clv.avgClv')}
              value={formatPercent(stats.avgClv)}
              tone={stats.avgClv > 0 ? 'good' : stats.avgClv < 0 ? 'bad' : undefined}
            />
            <Stat label={t('clv.positiveRate')} value={formatPercent(stats.positiveClvRate)} />
            <Stat label={t('clv.betCount')} value={String(stats.clvBetCount)} />
            <Stat label={t('clv.totalEv')} value={formatMoney(stats.totalEv, currency, { sign: true })} />
            <Stat
              label={t('clv.luck')}
              value={formatMoney(stats.luck, currency, { sign: true })}
              tone={stats.luck > 0 ? 'good' : stats.luck < 0 ? 'bad' : undefined}
            />
          </StatGrid>
        </Panel>
      ) : null}

      <Panel title={t('analytics.picks')}>
        <Dim style={{ marginBottom: space.sm }}>{t('analytics.picks.hint')}</Dim>
        {pickStats.pickCount === 0 ? (
          <Dim>{t('analytics.noPicks')}</Dim>
        ) : (
          <>
            <StatGrid>
              <Stat
                label={t('analytics.pickCount')}
                value={String(pickStats.pickCount)}
                sub={`${t('analytics.builderPicks')} ${pickStats.builderPickCount}`}
              />
              <Stat
                label={t('analytics.pickHitRate')}
                value={formatPercent(pickStats.hitRate)}
              />
              <Stat label={t('stat.wonCount')} value={String(pickStats.wonCount)} tone="good" />
              <Stat label={t('stat.lostCount')} value={String(pickStats.lostCount)} tone="bad" />
              <Stat label={t('stat.voidCount')} value={String(pickStats.voidCount)} />
              <Stat label={t('stat.pendingCount')} value={String(pickStats.pendingCount)} />
            </StatGrid>

            <View style={{ marginTop: space.md }}>
              <Chips
                compact
                value={pickDimension}
                onChange={setPickDimension}
                options={[
                  { value: 'market' as const, label: t('analytics.byMarket') },
                  { value: 'pick' as const, label: t('analytics.byPick') },
                ]}
              />
            </View>

            <View style={{ marginTop: space.md }}>
              {pickRows.map((row) => (
                <PickLine key={row.key} row={row} />
              ))}
            </View>
          </>
        )}
      </Panel>

      <Panel title={t('analytics.breakdown')}>
        <Chips
          compact
          value={dimension}
          onChange={setDimension}
          options={[
            { value: 'sport' as const, label: t('analytics.bySport') },
            { value: 'competition' as const, label: t('analytics.byCompetition') },
            { value: 'bookmaker' as const, label: t('analytics.byBookmaker') },
            { value: 'tipster' as const, label: t('analytics.byTipster') },
            { value: 'structure' as const, label: t('analytics.byStructure') },
            { value: 'tag' as const, label: t('analytics.byTag') },
            { value: 'odds' as const, label: t('analytics.byOdds') },
            { value: 'weekday' as const, label: t('analytics.byWeekday') },
            { value: 'month' as const, label: t('analytics.byMonth') },
          ]}
        />

        <View style={{ marginTop: space.md }}>
          {rows.length === 0 ? (
            <Dim>{t('analytics.noData')}</Dim>
          ) : (
            rows.map((row) => <BreakdownLine key={row.key} row={row} currency={currency} />)
          )}
        </View>
      </Panel>
    </View>
  );
}

function BreakdownLine({ row, currency }: { row: BreakdownRow; currency: string }) {
  const c = useColors();
  const { t, formatMoney, formatPercent } = useI18n();
  return (
    <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Row>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm,
                                         fontWeight: '600', flex: 1 }}>
          {row.label}
        </Text>
        <Text style={{ color: row.profit > 0 ? c.good : row.profit < 0 ? c.bad : c.textDim,
                       fontSize: font.sm, fontWeight: '700' }}>
          {formatMoney(row.profit, currency, { sign: true })}
        </Text>
      </Row>
      <Dim style={{ fontSize: font.xs, marginTop: 2 }}>
        {row.betCount} {t('bet.bets')} · {t('stat.hitRate')} {formatPercent(row.hitRate)} ·{' '}
        {t('stat.yield')} {formatPercent(row.yield)}
      </Dim>
    </View>
  );
}

/** One market or prediction, counted rather than priced. */
function PickLine({ row }: { row: PickBreakdownRow }) {
  const c = useColors();
  const { t, formatPercent } = useI18n();
  const resolved = row.wonCount + row.lostCount;

  return (
    <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Row>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm,
                                         fontWeight: '600', flex: 1 }}>
          {row.label}
        </Text>
        <Text style={{ color: resolved === 0 ? c.textDim : row.hitRate >= 0.5 ? c.good : c.bad,
                       fontSize: font.sm, fontWeight: '700' }}>
          {resolved > 0 ? formatPercent(row.hitRate) : '—'}
        </Text>
      </Row>
      <Dim style={{ fontSize: font.xs, marginTop: 2 }}>
        {row.pickCount} {t('analytics.pickCount')} · {row.wonCount} {t('status.won')} ·{' '}
        {row.lostCount} {t('status.lost')}
        {row.pendingCount > 0 ? ` · ${row.pendingCount} ${t('status.pending')}` : ''}
      </Dim>
    </View>
  );
}

/** Maps the selected dimension onto `breakdownBy`'s key function. */
function breakdown(
  bets: Bet[],
  dimension: Dimension,
  t: (key: never, params?: Record<string, string | number>) => string,
): BreakdownRow[] {
  switch (dimension) {
    case 'sport':
      return breakdownBy(
        bets,
        (b) => Array.from(new Set(b.selections.map((s) => s.sport))),
        (key) => t(`sport.${key}` as never),
      );
    case 'competition':
      return breakdownBy(bets, (b) =>
        Array.from(new Set(b.selections.map((s) => s.competition).filter(Boolean))),
      );
    case 'bookmaker':
      return breakdownBy(bets, (b) => b.bookmaker || t('common.unknown' as never));
    case 'tipster':
      return breakdownBy(bets, (b) => b.tipster || undefined);
    case 'structure':
      return breakdownBy(bets, (b) => b.structure, (key) =>
        t(`bet.structure.${key}` as never),
      );
    case 'tag':
      return breakdownBy(bets, (b) => b.tags);
    case 'odds':
      return breakdownBy(bets, (b) =>
        oddsBand(b.selections.reduce((acc, s) => acc * s.odds, 1)),
      );
    case 'weekday':
      return weekdayBreakdown(bets);
    case 'month':
      return monthlyBreakdown(bets);
  }
}
