import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { font, space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import { newId } from '../core/ids';
import { formatOdds, parseOdds } from '../core/odds';
import { SPORTS, sportIcon } from '../core/reference';
import { combinedOdds, settleBet } from '../core/settlement';
import { SYSTEM_PRESETS, systemLabel } from '../core/systems';
import {
  fixturesForLeague,
  leaguesForSports,
  type ResolvedFixture,
} from '../core/sportsData';
import type {
  Bet,
  BetSide,
  BetStructure,
  Selection,
  SelectionStatus,
} from '../core/types';
import { emptyBet, useApp } from '../state/AppContext';
import { useSportsData } from '../state/useSportsData';
import {
  Button,
  Chips,
  Confirm,
  Dim,
  Divider,
  Field,
  Input,
  NumberInput,
  Panel,
  Picker,
  Row,
  Sheet,
  Toggle,
} from '../ui';

const STRUCTURES: BetStructure[] = ['single', 'accumulator', 'system'];
const LEG_STATUSES: SelectionStatus[] = ['pending', 'won', 'lost', 'void', 'half_won', 'half_lost'];

/**
 * Create and edit a bet.
 *
 * The screen edits a whole `Bet` in local state and only writes on save, so a
 * half-finished bet never reaches the store and a cancel really cancels.
 * Validation mirrors the web form's rules, and the settlement summary at the
 * bottom recomputes from the same `settleBet` the statistics use — what the
 * user sees here is what the dashboard will count.
 */
export default function BetForm({ betId }: { betId: string }) {
  const c = useColors();
  const { t, formatMoney } = useI18n();
  const router = useRouter();
  const {
    settings,
    bankrolls,
    bets,
    activeBankrollId,
    currency,
    saveBet,
    deleteBets,
  } = useApp();

  const existing = betId === 'new' ? undefined : bets.find((b) => b.id === betId);

  const liveBankrolls = bankrolls.filter((b) => !b.archived);
  const initialBankroll =
    existing?.bankrollId ?? activeBankrollId ?? liveBankrolls[0]?.id ?? '';

  const [bet, setBet] = useState<Bet>(
    () =>
      existing ??
      emptyBet(
        initialBankroll,
        {
          bookmaker: settings.defaultBookmaker,
          commission: settings.defaultCommission,
          unitStake: liveBankrolls.find((b) => b.id === initialBankroll)?.defaultStake ?? 0,
        },
        liveBankrolls.find((b) => b.id === initialBankroll)?.sports ?? [],
      ),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patch = (p: Partial<Bet>) => setBet((prev) => ({ ...prev, ...p }));

  const patchSelection = (id: string, p: Partial<Selection>) =>
    setBet((prev) => ({
      ...prev,
      selections: prev.selections.map((s) => (s.id === id ? { ...s, ...p } : s)),
    }));

  const bankroll = bankrolls.find((b) => b.id === bet.bankrollId);
  const allowedSports = bankroll?.sports ?? [];

  const errors = useMemo(() => {
    const found: string[] = [];
    if (!bet.bankrollId) found.push(t('bet.needBankroll'));
    if (bet.selections.length === 0) found.push(t('bet.needSelection'));
    if (!(bet.unitStake > 0)) found.push(t('bet.needStake'));
    if (bet.selections.some((s) => !(s.odds > 1))) found.push(t('bet.needOdds'));
    if (bet.selections.some((s) => !s.event.trim())) found.push(t('bet.needEvent'));
    if (bet.selections.some((s) => s.picks.every((p) => !p.pick.trim()))) {
      found.push(t('bet.needPick'));
    }
    if (bet.structure === 'system' && bet.selections.length < 2) {
      found.push(t('bet.systemNeedsTwo'));
    }
    if (bet.structure === 'accumulator' && bet.selections.length < 2) {
      found.push(t('bet.accaNeedsTwo'));
    }
    if (bet.structure === 'single' && bet.selections.length !== 1) {
      found.push(t('bet.singleNeedsOne'));
    }
    // A lay is a position against one outcome; combining lays into one slip is
    // not a product any book offers, so it is refused rather than mis-settled.
    if (bet.selections.length > 1 && bet.selections.some((s) => s.side === 'lay')) {
      found.push(t('bet.layOnlySingle'));
    }
    if (allowedSports.length > 0) {
      for (const s of bet.selections) {
        if (!allowedSports.includes(s.sport)) {
          found.push(t('bet.sportNotAllowed', { sport: t(`sport.${s.sport}` as never) }));
          break;
        }
      }
    }
    return found;
  }, [bet, allowedSports, t]);

  const settlement = useMemo(() => settleBet(bet), [bet]);

  async function onSave() {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    await saveBet(bet);
    router.back();
  }

  function addSelection() {
    setBet((prev) => ({
      ...prev,
      // Two or more legs is never a single; promote it so the stake maths and
      // the settlement match what was just built.
      structure: prev.structure === 'single' ? 'accumulator' : prev.structure,
      selections: [
        ...prev.selections,
        {
          id: newId('sel_'),
          event: '',
          sport: allowedSports[0] ?? prev.selections[0]?.sport ?? 'football',
          competition: '',
          picks: [{ id: newId('pk_'), market: '', pick: '' }],
          odds: 0,
          side: 'back',
          status: 'pending',
        },
      ],
    }));
  }

  function removeSelection(id: string) {
    setBet((prev) => {
      const selections = prev.selections.filter((s) => s.id !== id);
      return {
        ...prev,
        selections,
        structure: selections.length < 2 ? 'single' : prev.structure,
      };
    });
  }

  return (
    <View>
      <Panel>
        <Field label={t('bankroll.bankroll')}>
          <Picker
            value={bet.bankrollId}
            options={liveBankrolls.map((b) => ({ value: b.id, label: b.name }))}
            onChange={(id) => patch({ bankrollId: id })}
            title={t('bankroll.switch')}
          />
        </Field>

        <Field label={t('bet.structure')}>
          <Chips
            compact
            value={bet.structure}
            onChange={(v) =>
              patch({
                structure: v,
                // A system with no covered sizes settles as nothing; seed the
                // smallest useful one so the bet is valid the moment it is picked.
                system: v === 'system' ? (bet.system ?? { sizes: [2], preset: 'custom' }) : bet.system,
              })
            }
            options={STRUCTURES.map((s) => ({
              value: s,
              label: t(`bet.structure.${s}` as never),
            }))}
          />
        </Field>

        {bet.structure === 'system' ? (
          <Field
            label={t('bet.system.preset')}
            hint={systemLabel(bet.system ?? { sizes: [] }, bet.selections.length)}
          >
            {/* Only the presets that fit the current number of legs: a Yankee
                needs exactly four, and offering it on three would produce a
                system that cannot settle. */}
            <Chips
              compact
              value={bet.system?.preset ?? 'custom'}
              onChange={(key) => {
                const preset = SYSTEM_PRESETS.find((p) => p.key === key);
                patch({
                  system: preset
                    ? { sizes: preset.sizes, preset: key }
                    : { sizes: [2], preset: 'custom' },
                });
              }}
              options={[
                { value: 'custom', label: t('bet.system.custom') },
                ...SYSTEM_PRESETS.filter((p) => p.selections === bet.selections.length).map(
                  (p) => ({ value: p.key, label: p.label }),
                ),
              ]}
            />

            {/* Custom systems pick their combination sizes directly. */}
            {(bet.system?.preset ?? 'custom') === 'custom' ? (
              <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
                {Array.from({ length: bet.selections.length }, (_, i) => i + 1).map((size) => {
                  const on = bet.system?.sizes.includes(size) ?? false;
                  return (
                    <Pressable
                      key={size}
                      onPress={() => {
                        const sizes = on
                          ? (bet.system?.sizes ?? []).filter((s) => s !== size)
                          : [...(bet.system?.sizes ?? []), size];
                        patch({ system: { sizes, preset: 'custom' } });
                      }}
                      style={{
                        paddingHorizontal: space.md,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: on ? c.accent : c.border,
                        backgroundColor: on ? c.accent : 'transparent',
                      }}
                    >
                      <Text style={{ color: on ? c.accentText : c.text, fontSize: font.xs,
                                     fontWeight: '700' }}>
                        {size}
                      </Text>
                    </Pressable>
                  );
                })}
              </Row>
            ) : null}
          </Field>
        ) : null}
      </Panel>

      {bet.selections.map((selection, index) => (
        <SelectionCard
          key={selection.id}
          index={index}
          selection={selection}
          allowedSports={allowedSports}
          oddsFormat={settings.oddsFormat}
          canRemove={bet.selections.length > 1}
          onChange={(p) => patchSelection(selection.id, p)}
          onRemove={() => removeSelection(selection.id)}
        />
      ))}

      <Button label={t('bet.addSelection')} tone="ghost" onPress={addSelection}
              style={{ marginBottom: space.md }} />

      <Panel title={t('bet.stake')}>
        <Field label={bet.structure === 'system' ? t('bet.unitStake') : t('bet.stake')}>
          <NumberInput
            value={bet.unitStake || undefined}
            onChange={(v) => patch({ unitStake: v ?? 0 })}
            placeholder="0"
          />
        </Field>

        <Field label={t('bet.bookmaker')}>
          <Picker
            value={bet.bookmaker}
            options={settings.bookmakers.map((b) => ({ value: b, label: b }))}
            onChange={(v) => patch({ bookmaker: v })}
            placeholder={t('common.optional')}
            title={t('bet.bookmaker')}
          />
        </Field>

        <Field label={t('bet.commission')}>
          <NumberInput
            value={bet.commission || undefined}
            onChange={(v) => patch({ commission: v ?? 0 })}
            placeholder="0"
          />
        </Field>

        {settings.tipsters.length > 0 ? (
          <Field label={t('bet.tipster')}>
            <Picker
              value={bet.tipster ?? ''}
              options={settings.tipsters.map((x) => ({ value: x, label: x }))}
              onChange={(v) => patch({ tipster: v })}
              placeholder={t('common.optional')}
              title={t('bet.tipster')}
            />
          </Field>
        ) : null}

        <Field label={t('bet.tags')} hint={t('common.optional')}>
          <Input
            value={bet.tags.join(', ')}
            onChange={(v) =>
              patch({ tags: v.split(',').map((x) => x.trim()).filter(Boolean) })
            }
            autoCapitalize="none"
          />
        </Field>

        <Field label={t('bet.note')} hint={t('common.optional')}>
          <Input value={bet.note ?? ''} onChange={(v) => patch({ note: v })} multiline />
        </Field>

        <Toggle
          label={t('bet.freeBet')}
          hint={t('bet.freeBet.hint')}
          value={!!bet.freeBet}
          onChange={(v) => patch({ freeBet: v })}
        />

        <Toggle
          label={t('bet.eachWay')}
          value={!!bet.eachWay}
          onChange={(v) => patch({ eachWay: v ? { places: 3, fraction: 0.2 } : undefined })}
        />

        {bet.eachWay ? (
          <Row gap={space.md}>
            <Field label={t('bet.eachWay.places')} style={{ flex: 1 }}>
              <NumberInput
                decimals={false}
                value={bet.eachWay.places}
                onChange={(v) =>
                  patch({ eachWay: { ...bet.eachWay!, places: v ?? 3 } })
                }
              />
            </Field>
            <Field label={t('bet.eachWay.fraction')} style={{ flex: 1 }}>
              <NumberInput
                value={bet.eachWay.fraction}
                onChange={(v) =>
                  patch({ eachWay: { ...bet.eachWay!, fraction: v ?? 0.2 } })
                }
              />
            </Field>
          </Row>
        ) : null}

        <Field label={t('bet.cashOutAmount')} hint={t('common.optional')}>
          <NumberInput
            value={bet.cashOutAmount}
            onChange={(v) => patch({ cashOutAmount: v })}
            placeholder="—"
          />
        </Field>
      </Panel>

      <Panel title={t('bet.profit')}>
        <SummaryRow label={t('bet.combinedOdds')}
                    value={formatOdds(combinedOdds(bet), settings.oddsFormat)} />
        <SummaryRow label={t('bet.lines')} value={String(settlement.lineCount)} />
        <SummaryRow label={t('bet.totalStake')}
                    value={formatMoney(settlement.totalStake, currency)} />
        {bet.selections.some((s) => s.side === 'lay') ? (
          <SummaryRow label={t('bet.liability')} value={formatMoney(settlement.risk, currency)} />
        ) : null}
        <SummaryRow
          label={settlement.settled ? t('bet.profit') : t('bet.potentialProfit')}
          value={formatMoney(
            settlement.settled ? settlement.profit : settlement.returned - settlement.totalStake,
            currency,
            { sign: true },
          )}
          tone={settlement.settled ? (settlement.profit >= 0 ? 'good' : 'bad') : undefined}
        />
      </Panel>

      {showErrors && errors.length > 0 ? (
        <View style={{ backgroundColor: c.errBg, borderColor: c.errBorder, borderWidth: 1,
                       borderRadius: 10, padding: space.md, marginBottom: space.md }}>
          {errors.map((e) => (
            <Text key={e} style={{ color: c.errText, fontSize: font.sm }}>• {e}</Text>
          ))}
        </View>
      ) : null}

      <Row gap={space.md}>
        <Button label={t('action.cancel')} tone="ghost" onPress={() => router.back()}
                style={{ flex: 1 }} />
        <Button label={t('action.save')} onPress={onSave} style={{ flex: 1 }} />
      </Row>

      {existing ? (
        <Button
          label={t('action.delete')}
          tone="danger"
          onPress={() => setDeleting(true)}
          style={{ marginTop: space.md }}
        />
      ) : null}

      <Confirm
        open={deleting}
        title={t('action.delete')}
        message={t('bet.deleteConfirm')}
        confirmLabel={t('action.delete')}
        cancelLabel={t('action.cancel')}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          void deleteBets([bet.id]);
          setDeleting(false);
          router.back();
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * One leg
 * ------------------------------------------------------------------ */

function SelectionCard({
  index,
  selection,
  allowedSports,
  oddsFormat,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  selection: Selection;
  allowedSports: string[];
  oddsFormat: string;
  canRemove: boolean;
  onChange: (patch: Partial<Selection>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const c = useColors();
  const [fixturesOpen, setFixturesOpen] = useState(false);

  const sports = allowedSports.length > 0
    ? SPORTS.filter((s) => allowedSports.includes(s.key))
    : SPORTS;

  return (
    <Panel
      title={`${t('bet.selections')} ${index + 1}`}
      action={
        canRemove ? (
          <Pressable onPress={onRemove} hitSlop={10}>
            <Text style={{ color: c.bad, fontSize: font.sm, fontWeight: '700' }}>
              {t('bet.removeSelection')}
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      <Field label={t('bet.sport')}>
        <Picker
          value={selection.sport}
          options={sports.map((s) => ({
            value: s.key,
            label: `${sportIcon(s.key)} ${t(`sport.${s.key}` as never)}`,
          }))}
          onChange={(v) => onChange({ sport: v })}
          title={t('bet.sport')}
        />
      </Field>

      <Field label={t('bet.event')}>
        <Input value={selection.event} onChange={(v) => onChange({ event: v })} />
      </Field>

      <Button
        label={t('bet.selectMatch')}
        tone="ghost"
        onPress={() => setFixturesOpen(true)}
        style={{ marginTop: space.sm }}
      />

      <Field label={t('bet.competition')} hint={t('common.optional')}>
        <Input value={selection.competition} onChange={(v) => onChange({ competition: v })} />
      </Field>

      <Divider />

      {selection.picks.map((pick, i) => (
        <View key={pick.id}>
          <Field label={`${t('bet.market')} ${selection.picks.length > 1 ? i + 1 : ''}`.trim()}>
            <Input
              value={pick.market}
              onChange={(v) =>
                onChange({
                  picks: selection.picks.map((p) => (p.id === pick.id ? { ...p, market: v } : p)),
                })
              }
            />
          </Field>
          <Field label={t('bet.pick')}>
            <Row gap={space.sm}>
              <Input
                value={pick.pick}
                onChange={(v) =>
                  onChange({
                    picks: selection.picks.map((p) => (p.id === pick.id ? { ...p, pick: v } : p)),
                  })
                }
                style={{ flex: 1 }}
              />
              {selection.picks.length > 1 ? (
                <Pressable
                  onPress={() =>
                    onChange({ picks: selection.picks.filter((p) => p.id !== pick.id) })
                  }
                  hitSlop={10}
                >
                  <Text style={{ color: c.bad, fontSize: font.lg }}>✕</Text>
                </Pressable>
              ) : null}
            </Row>
          </Field>
        </View>
      ))}

      <Button
        label={t('bet.addPick')}
        tone="ghost"
        onPress={() =>
          onChange({
            picks: [...selection.picks, { id: newId('pk_'), market: '', pick: '' }],
          })
        }
        style={{ marginTop: space.sm }}
      />
      <Dim style={{ marginTop: space.xs, fontSize: font.xs }}>{t('bet.builder.hint')}</Dim>

      <Divider />

      <Row gap={space.md}>
        <Field label={t('bet.odds')} style={{ flex: 1 }}>
          <OddsInput
            value={selection.odds}
            format={oddsFormat}
            onChange={(v) => onChange({ odds: v })}
          />
        </Field>
        <Field label={t('bet.closingOdds')} style={{ flex: 1 }}>
          <OddsInput
            value={selection.closingOdds}
            format={oddsFormat}
            onChange={(v) => onChange({ closingOdds: v || undefined })}
          />
        </Field>
      </Row>

      <Field label={t('bet.side')}>
        <Chips
          compact
          value={selection.side}
          onChange={(v: BetSide) => onChange({ side: v })}
          options={[
            { value: 'back' as BetSide, label: t('bet.side.back') },
            { value: 'lay' as BetSide, label: t('bet.side.lay') },
          ]}
        />
      </Field>

      <Field label={t('common.count')}>
        <Chips
          compact
          value={selection.status}
          onChange={(v: SelectionStatus) => onChange({ status: v })}
          options={LEG_STATUSES.map((s) => ({
            value: s,
            label:
              s === 'half_won' ? `½ ${t('status.won')}`
              : s === 'half_lost' ? `½ ${t('status.lost')}`
              : t(`status.${s}` as never),
          }))}
        />
      </Field>

      <FixtureSheet
        open={fixturesOpen}
        sport={selection.sport}
        onClose={() => setFixturesOpen(false)}
        onPick={(fixture, leagueName) => {
          onChange({
            event: fixture.label,
            homeTeam: fixture.home.name,
            awayTeam: fixture.away.name,
            leagueId: fixture.leagueId,
            fixtureId: fixture.id,
            competition: leagueName,
            eventAt: fixture.kickoff,
          });
          setFixturesOpen(false);
        }}
      />
    </Panel>
  );
}

/** Odds entry in the user's display format, stored as decimal. */
function OddsInput({
  value,
  format,
  onChange,
}: {
  value: number | undefined;
  format: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(
    value && value > 1 ? formatOdds(value, format as never) : '',
  );

  return (
    <Input
      value={text}
      autoCapitalize="none"
      onChange={(next) => {
        setText(next);
        onChange(parseOdds(next.replace(',', '.'), format as never) ?? 0);
      }}
      placeholder={format === 'american' ? '+150' : format === 'fractional' ? '3/2' : '2.50'}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Fixture picker
 * ------------------------------------------------------------------ */

function FixtureSheet({
  open,
  sport,
  onClose,
  onPick,
}: {
  open: boolean;
  sport: string;
  onClose: () => void;
  onPick: (fixture: ResolvedFixture, leagueName: string) => void;
}) {
  const { t, formatDate } = useI18n();
  const c = useColors();
  const { catalog, fixtures, loading } = useSportsData();
  const [leagueId, setLeagueId] = useState('');

  const leagues = useMemo(
    () => leaguesForSports(catalog, sport ? [sport] : []),
    [catalog, sport],
  );

  const rows = useMemo(
    () => (leagueId ? fixturesForLeague(catalog, fixtures, leagueId).slice(0, 60) : []),
    [catalog, fixtures, leagueId],
  );

  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? '';

  return (
    <Sheet open={open} onClose={onClose} title={t('bet.selectMatch')}>
      {loading ? (
        <Dim>{t('common.loading')}</Dim>
      ) : leagues.length === 0 ? (
        <Dim>{t('bet.noFixtures')}</Dim>
      ) : (
        <>
          <Chips
            compact
            value={leagueId}
            onChange={setLeagueId}
            options={leagues.map((l) => ({ value: l.id, label: l.name }))}
          />
          <View style={{ marginTop: space.md, maxHeight: 360 }}>
            {!leagueId ? (
              <Dim>{t('bet.pickLeagueFirst')}</Dim>
            ) : rows.length === 0 ? (
              <Dim>{t('bet.noFixtures')}</Dim>
            ) : (
              rows.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => onPick(f, leagueName)}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
                >
                  <Text style={{ color: c.text, fontSize: font.sm }}>{f.label}</Text>
                  <Text style={{ color: c.textDim, fontSize: font.xs }}>
                    {formatDate(f.kickoff, 'dateTime')}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  const c = useColors();
  const color = tone === 'good' ? c.good : tone === 'bad' ? c.bad : c.text;
  return (
    <Row style={{ paddingVertical: 6 }}>
      <Text style={{ color: c.textDim, fontSize: font.sm, flex: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: font.md, fontWeight: '600' }}>{value}</Text>
    </Row>
  );
}
