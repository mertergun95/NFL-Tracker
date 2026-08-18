import { useState } from 'react';
import { useI18n } from '@bt/i18n';
import { formatOdds } from '@bt/core/odds';
import {
  combinedOdds,
  isBuilder,
  isSettled,
  pickStatus,
  settleBet,
  withLegStatus,
  withPickStatus,
} from '@bt/core/settlement';
import { systemLabel } from '@bt/core/systems';
import { sportIcon } from '@bt/core/reference';
import type { Bet, OddsFormat, Selection, SelectionStatus } from '@bt/core/types';
import { StatusBadge, StatusPicker } from './ui';

/**
 * The bet row. Shows the whole bet at a glance and expands multi-leg bets
 * inline, because the legs are the reason a multiple won or lost.
 *
 * The row opens the edit form; the ▾ next to it opens the detail panel, where
 * the bet is settled without leaving the list. Those are separate controls on
 * purpose — settling is frequent, and routing it through a nine-field form
 * made the common case the slowest one.
 */
export function BetRow({
  bet,
  currency,
  oddsFormat,
  selected,
  selectable,
  onToggleSelect,
  onOpen,
  onSettleSelections,
}: {
  bet: Bet;
  currency: string;
  oddsFormat: OddsFormat;
  selected?: boolean;
  selectable?: boolean;
  onToggleSelect?: () => void;
  onOpen?: () => void;
  /** Writes a new set of legs back to the bet. Omit to hide the detail panel. */
  onSettleSelections?: (selections: Selection[]) => void;
}) {
  const { t, formatMoney, formatDate } = useI18n();
  const [open, setOpen] = useState(false);

  const settlement = settleBet(bet);
  const settled = isSettled(bet);
  const multi = bet.selections.length > 1;
  const first = bet.selections[0];

  const title = multi
    ? `${bet.selections.length}× ${
        bet.structure === 'system'
          ? systemLabel(bet.system ?? { sizes: [2] }, bet.selections.length)
          : t('bet.structure.accumulator')
      }`
    : (first?.event || first?.picks[0]?.pick || '—');

  /** Replaces one leg, leaving the others untouched. */
  const replaceSelection = (next: Selection) =>
    onSettleSelections?.(bet.selections.map((s) => (s.id === next.id ? next : s)));

  return (
    <div className="bet-entry">
      <div className={`bet-item${selected ? ' is-selected' : ''}`}>
        {selectable && (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={onToggleSelect}
            style={{ marginTop: 3, width: 17, height: 17, accentColor: 'var(--accent)' }}
            aria-label={t('action.select')}
          />
        )}

        <button
          type="button"
          onClick={onOpen}
          className="bet-item__body"
          style={{ textAlign: 'left', background: 'none', padding: 0 }}
        >
          <div className="bet-item__top">
            <span className="bet-item__event">
              {first && !multi && `${sportIcon(first.sport)} `}
              {title}
            </span>
            <StatusBadge status={settlement.status} />
            {bet.freeBet && <span className="badge">{t('bet.freeBet')}</span>}
            {bet.eachWay && <span className="badge">E/W</span>}
            {first?.side === 'lay' && <span className="badge">{t('bet.side.lay')}</span>}
            {!multi && (first?.picks.length ?? 0) > 1 && (
              <span className="badge badge--pending">
                {t('bet.builder')} ×{first!.picks.length}
              </span>
            )}
          </div>

          {!multi && first && (
            <div className="bet-item__meta">
              {/* Several picks on one event means a bet builder; show them all. */}
              <span>
                {first.picks
                  .map((p) => p.pick || p.market)
                  .filter(Boolean)
                  .join('  +  ') || '—'}
              </span>
              {first.competition && <span className="bet-item__dot">{first.competition}</span>}
            </div>
          )}

          <div className="bet-item__meta">
            <span>{formatDate(bet.placedAt, 'dateTime')}</span>
            {bet.bookmaker && <span className="bet-item__dot">{bet.bookmaker}</span>}
            <span className="bet-item__dot">
              @ {formatOdds(combinedOdds(bet), oddsFormat)}
            </span>
            {bet.tipster && <span className="bet-item__dot">{bet.tipster}</span>}
          </div>

          {bet.tags.length > 0 && (
            <div className="chip-row" style={{ marginTop: 5 }}>
              {bet.tags.map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {multi && (
            <div className="bet-item__legs">
              {bet.selections.map((s) => (
                <div className="bet-item__leg" key={s.id}>
                  <span>{sportIcon(s.sport)}</span>
                  <span className="truncate" style={{ flex: 1 }}>
                    {s.event || '—'}
                    {s.picks.some((p) => p.pick)
                      ? ` · ${s.picks.map((p) => p.pick).filter(Boolean).join(' + ')}`
                      : ''}
                  </span>
                  <span className="bt-num">{formatOdds(s.odds, oddsFormat)}</span>
                  <span
                    className={
                      s.status === 'won'
                        ? 'is-positive'
                        : s.status === 'lost'
                          ? 'is-negative'
                          : 'faint'
                    }
                  >
                    {s.status === 'won' ? '✓' : s.status === 'lost' ? '✗' : '•'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </button>

        <div className="bet-item__right">
          <div
            className={`bet-item__profit ${
              !settled ? 'is-neutral' : settlement.profit > 0 ? 'is-positive' : settlement.profit < 0 ? 'is-negative' : 'is-neutral'
            }`}
          >
            {settled
              ? formatMoney(settlement.profit, currency, { sign: true })
              : formatMoney(settlement.risk, currency)}
          </div>
          <div className="bet-item__stake">
            {settled
              ? `${t('bet.stake')} ${formatMoney(settlement.totalStake, currency)}`
              : t('status.pending')}
          </div>
        </div>

        {onSettleSelections && (
          <button
            type="button"
            className="bet-item__toggle"
            aria-expanded={open}
            aria-label={open ? t('bet.hideDetails') : t('bet.details')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>

      {open && onSettleSelections && (
        <div className="bet-detail">
          {bet.selections.map((selection) => (
            <LegDetail
              key={selection.id}
              selection={selection}
              oddsFormat={oddsFormat}
              onChange={replaceSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One leg of an expanded bet.
 *
 * A bet builder is priced as a single leg but is several predictions, and each
 * one is right or wrong on its own — so each gets its own outcome buttons and
 * the leg's status is read off them rather than set by hand. Without that, the
 * three picks that landed inside a four-pick builder would be invisible to the
 * statistics.
 */
function LegDetail({
  selection,
  oddsFormat,
  onChange,
}: {
  selection: Selection;
  oddsFormat: OddsFormat;
  onChange: (selection: Selection) => void;
}) {
  const { t } = useI18n();
  const builder = isBuilder(selection);

  return (
    <div className="bet-detail__leg">
      <div className="bet-detail__head">
        <span>{sportIcon(selection.sport)}</span>
        <span className="truncate" style={{ flex: 1 }}>
          {selection.event || '—'}
        </span>
        {selection.competition && (
          <span className="bet-detail__pick-market">{selection.competition}</span>
        )}
        <span className="bt-num">{formatOdds(selection.odds, oddsFormat)}</span>
      </div>

      {builder ? (
        <>
          <div className="bet-detail__pick-market">
            {t('bet.builder')} ×{selection.picks.length} · {t('bet.builder.perPick')}
          </div>

          {selection.picks.map((pick) => (
            <div className="bet-detail__pick" key={pick.id}>
              <span className="bet-detail__pick-label">
                {pick.pick || pick.market || '—'}
                {pick.pick && pick.market && (
                  <span className="bet-detail__pick-market"> · {pick.market}</span>
                )}
              </span>
              <StatusPicker
                label={t('bet.pickOutcome')}
                value={pickStatus(selection, pick)}
                onChange={(status) => onChange(withPickStatus(selection, pick.id, status))}
              />
            </div>
          ))}

          <div className="bet-detail__pick-market">
            {t('bet.legOutcome')}: <StatusBadgeInline status={selection.status} /> ·{' '}
            {t('bet.builder.derived')}
          </div>
        </>
      ) : (
        <div className="bet-detail__pick">
          <span className="bet-detail__pick-label">
            {selection.picks[0]?.pick || selection.picks[0]?.market || '—'}
          </span>
          <StatusPicker
            label={t('bet.legOutcome')}
            value={selection.status}
            onChange={(status) => onChange(withLegStatus(selection, status))}
          />
        </div>
      )}
    </div>
  );
}

/** The derived leg status, shown rather than offered. */
function StatusBadgeInline({ status }: { status: SelectionStatus }) {
  const { t } = useI18n();
  const key =
    status === 'half_won'
      ? 'status.half_won'
      : status === 'half_lost'
        ? 'status.half_lost'
        : (`status.${status}` as 'status.won');
  return <strong>{t(key)}</strong>;
}

export default function BetList({
  bets,
  currency,
  oddsFormat,
  selectedIds,
  onToggleSelect,
  onOpen,
  onSettleSelections,
  selectable,
}: {
  bets: Bet[];
  currency: string;
  oddsFormat: OddsFormat;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onOpen?: (bet: Bet) => void;
  onSettleSelections?: (bet: Bet, selections: Selection[]) => void;
  selectable?: boolean;
}) {
  return (
    <div>
      {bets.map((bet) => (
        <BetRow
          key={bet.id}
          bet={bet}
          currency={currency}
          oddsFormat={oddsFormat}
          selectable={selectable}
          selected={selectedIds?.has(bet.id)}
          onToggleSelect={() => onToggleSelect?.(bet.id)}
          onOpen={() => onOpen?.(bet)}
          onSettleSelections={
            onSettleSelections
              ? (selections) => onSettleSelections(bet, selections)
              : undefined
          }
        />
      ))}
    </div>
  );
}
