import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { font, space, useColors } from '../../lib/theme';
import { SearchBar } from '../../components/ui';
import { useI18n } from '../i18n';
import { applyFilter } from '../core/store';
import { settleBet } from '../core/settlement';
import type { Bet, BetStatus, SelectionStatus } from '../core/types';
import { useApp } from '../state/AppContext';
import { BankrollSwitcher, BetCard } from '../components';
import { Button, Chips, Confirm, Dim, Row, Sheet } from '../ui';

const STATUS_FILTERS: BetStatus[] = ['pending', 'won', 'lost', 'void', 'partial'];

/**
 * The bet log: search, a status filter, and the quick-settle sheet.
 *
 * Quick settle marks every leg at once, which covers singles and the common
 * accumulator case. Anything finer — a half-won Asian line, one leg voided —
 * is edited on the bet's own screen, where each leg has its own control.
 */
export default function Bets() {
  const c = useColors();
  const { t } = useI18n();
  const router = useRouter();
  const { settings, scopedBets, updateBets, deleteBets } = useApp();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BetStatus | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [settling, setSettling] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);

  const rows = useMemo(
    () =>
      applyFilter(scopedBets, {
        search: search || undefined,
        statuses: status === 'all' ? undefined : [status],
      }),
    [scopedBets, search, status],
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function settleAs(ids: string[], legStatus: SelectionStatus) {
    // `updateBets` patches whole bets, so each one's legs are rewritten with
    // the chosen outcome and the store stamps `settledAt` on the way through.
    for (const id of ids) {
      const bet = scopedBets.find((b) => b.id === id);
      if (!bet) continue;
      await updateBets([id], {
        selections: bet.selections.map((s) => ({ ...s, status: legStatus })),
      });
    }
    setSettling(null);
    setSelected([]);
  }

  return (
    <View>
      <BankrollSwitcher />

      <SearchBar value={search} onChange={setSearch} placeholder={t('bets.filter.search')} />

      <View style={{ marginTop: space.sm }}>
        <Chips
          compact
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all' as const, label: t('common.all') },
            ...STATUS_FILTERS.map((s) => ({ value: s, label: t(`status.${s}` as never) })),
          ]}
        />
      </View>

      <Row style={{ marginTop: space.md }}>
        <Dim style={{ flex: 1 }}>
          {t('bets.showing', { shown: rows.length, total: scopedBets.length })}
        </Dim>
        <Button label={t('bet.new')} onPress={() => router.push('/bets/bet/new')} />
      </Row>

      {selected.length > 0 ? (
        <Row gap={space.sm} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          <Text style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
            {t('bet.selected', { n: selected.length })}
          </Text>
          <Button label={t('action.settle')} tone="ghost" onPress={() => setSettling(selected)} />
          <Button label={t('action.delete')} tone="danger" onPress={() => setDeleting(selected)} />
          <Button label={t('action.deselect')} tone="ghost" onPress={() => setSelected([])} />
        </Row>
      ) : null}

      <View style={{ marginTop: space.md }}>
        {rows.length === 0 ? (
          <Dim style={{ textAlign: 'center', paddingVertical: space.xxl }}>
            {scopedBets.length === 0 ? t('bets.emptyAll') : t('bets.empty')}
          </Dim>
        ) : (
          rows.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              oddsFormat={settings.oddsFormat}
              selected={selected.includes(bet.id)}
              onToggleSelect={() => toggle(bet.id)}
              onEdit={() => router.push(`/bets/bet/${bet.id}` as never)}
              onDelete={() => setDeleting([bet.id])}
            />
          ))
        )}
      </View>

      <QuickSettle
        ids={settling}
        onClose={() => setSettling(null)}
        onPick={(legStatus) => void settleAs(settling ?? [], legStatus)}
      />

      <Confirm
        open={deleting !== null}
        title={t('action.delete')}
        message={
          (deleting?.length ?? 0) > 1
            ? t('bet.deleteManyConfirm', { n: deleting?.length ?? 0 })
            : t('bet.deleteConfirm')
        }
        confirmLabel={t('action.delete')}
        cancelLabel={t('action.cancel')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          void deleteBets(deleting ?? []);
          setDeleting(null);
          setSelected([]);
        }}
      />
    </View>
  );
}

function QuickSettle({
  ids,
  onClose,
  onPick,
}: {
  ids: string[] | null;
  onClose: () => void;
  onPick: (status: SelectionStatus) => void;
}) {
  const { t } = useI18n();
  const options: SelectionStatus[] = ['won', 'lost', 'void', 'pending'];

  return (
    <Sheet open={ids !== null} onClose={onClose} title={t('bets.quickSettle')}>
      {options.map((s) => (
        <Button
          key={s}
          label={t(`status.${s}` as never)}
          tone={s === 'won' ? 'primary' : 'ghost'}
          onPress={() => onPick(s)}
          style={{ marginBottom: space.sm }}
        />
      ))}
    </Sheet>
  );
}

/** Exported for the bet screen's "settle this bet" shortcut. */
export function isOpen(bet: Bet): boolean {
  return !settleBet(bet).settled;
}
