import React, { useMemo, useState } from 'react';
import type { TrainingGoal } from '../engines/metabolic';
import type { CurrencyCode } from '../engines/membership';
import { formatCurrency } from '../engines/membership';
import type { DisciplineId, ScheduleWindow } from '../engines/timetable';
import { matchTrainers } from '../engines/timetable';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import { CheckIcon, PulseIcon } from './Icons';

interface TrainersSectionProps {
  lang: Lang;
  currency: CurrencyCode;
  activeGoal: TrainingGoal;
  selectedCoachId: string;
  onSelectCoach: (coachId: string) => void;
}

const MODALITIES: Array<DisciplineId | 'all'> = [
  'all',
  'strength_barbell',
  'reformer_pilates',
  'hiit_lab',
  'cryo_recovery',
];

const WINDOWS: ScheduleWindow[] = ['morning', 'midday', 'evening'];

export const TrainersSection: React.FC<TrainersSectionProps> = ({
  lang,
  currency,
  activeGoal,
  selectedCoachId,
  onSelectCoach,
}) => {
  const t = COPY[lang].trainers;
  const tMeta = COPY[lang].metabolic;
  const tTime = COPY[lang].timetable;

  const [preferredDiscipline, setPreferredDiscipline] = useState<
    DisciplineId | 'all'
  >('all');
  const [window, setWindow] = useState<ScheduleWindow>('morning');

  const rankedTrainers = useMemo(
    () =>
      matchTrainers({
        goal: activeGoal,
        preferredDiscipline,
        window,
      }),
    [activeGoal, preferredDiscipline, window]
  );

  return (
    <section
      id="specialists"
      className="no-print border-b border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/35 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
              {t.eyebrow}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--vg-muted)]">{t.subtitle}</p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 font-mono-num text-xs lg:self-auto">
            <PulseIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
            <span className="text-[var(--vg-muted)]">{t.syncNote}:</span>
            <span className="font-bold text-[var(--vg-accent)]">
              {tMeta.goals[activeGoal].label}
            </span>
          </div>
        </div>

        {/* Matcher Filter Controls */}
        <div className="mt-7 grid gap-4 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 sm:p-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="font-mono-num text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
              {t.focusLabel}
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MODALITIES.map((mod) => {
                const active = preferredDiscipline === mod;
                const label =
                  mod === 'all' ? tTime.allDisciplines : tTime.disciplines[mod];
                return (
                  <button
                    key={mod}
                    type="button"
                    data-testid={`pt-modality-${mod}`}
                    onClick={() => setPreferredDiscipline(mod)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c]'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:border-[var(--vg-accent)] hover:text-[var(--vg-ink)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <span className="font-mono-num text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
              {t.windowLabel}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {WINDOWS.map((win) => {
                const active = window === win;
                return (
                  <button
                    key={win}
                    type="button"
                    data-testid={`pt-window-${win}`}
                    onClick={() => setWindow(win)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'border-[var(--vg-ink)] bg-[var(--vg-ink)] text-[var(--vg-bg)]'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:border-[var(--vg-accent)] hover:text-[var(--vg-ink)]'
                    }`}
                  >
                    {t.windows[win].split(' ')[0]}
                    <span className="block font-mono-num text-[9px] opacity-75">
                      {win === 'morning'
                        ? '05:30–10:00'
                        : win === 'midday'
                          ? '11:00–15:00'
                          : '17:00–21:30'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ranked Trainers Grid */}
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rankedTrainers.map((trainer, index) => {
            const isSelected = trainer.id === selectedCoachId;
            const isTopMatch = index === 0;
            const reasons =
              lang === 'en' ? trainer.matchedReasonsEn : trainer.matchedReasonsVi;

            return (
              <article
                key={trainer.id}
                data-testid={`trainer-card-${trainer.id}`}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? 'border-[#a3e635] bg-[var(--vg-surface)] shadow-[0_0_0_1px_rgba(163,230,53,0.3)]'
                    : isTopMatch
                      ? 'border-[var(--vg-accent)]/50 bg-[var(--vg-surface)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-[var(--vg-accent)]/50'
                }`}
              >
                <div>
                  {/* Top Row: Architectural Monogram Avatar + Match Score */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--vg-border)] bg-[#08090c] font-display text-base font-bold tracking-wider text-[#e2e8f0]"
                        style={{
                          boxShadow: `inset 0 0 0 1.5px ${trainer.accentHue}55`,
                        }}
                      >
                        {trainer.initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-[var(--vg-ink)]">
                          {trainer.name}
                        </h3>
                        <p className="text-xs font-medium text-[var(--vg-muted)]">
                          {lang === 'en' ? trainer.titleEn : trainer.titleVi}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/12 px-2.5 py-1 text-right">
                      <div className="font-mono-num text-sm font-bold leading-none text-[var(--vg-accent)]">
                        {trainer.matchScore}%
                      </div>
                      <div className="font-mono-num mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-[var(--vg-muted)]">
                        {t.matchBadge}
                      </div>
                    </div>
                  </div>

                  {/* Signature Methodology */}
                  <p className="mt-3.5 text-xs leading-relaxed text-[var(--vg-muted)]">
                    {lang === 'en' ? trainer.signatureEn : trainer.signatureVi}
                  </p>

                  {/* Credentials */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {trainer.credentials.map((cred) => (
                      <span
                        key={cred}
                        className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--vg-ink)]"
                      >
                        {cred}
                      </span>
                    ))}
                  </div>

                  {/* Match Reasons */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-[var(--vg-accent)]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--vg-accent)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer: Experience / Languages / Rate + Select CTA */}
                <div className="mt-5 border-t border-[var(--vg-border)] pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-num text-[11px] text-[var(--vg-muted)]">
                      {trainer.experienceYears} {t.expYears} ·{' '}
                      {trainer.languages.join('/')}
                    </span>
                    <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                      {formatCurrency(trainer.hourlyRateVnd, currency)}{' '}
                      <span className="font-normal text-[var(--vg-muted)]">
                        {t.perSession}
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid={`select-coach-${trainer.id}`}
                    onClick={() => onSelectCoach(trainer.id)}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border border-[#a3e635] bg-[#a3e635]/15 text-[var(--vg-accent)]'
                        : 'border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[#a3e635] hover:bg-[#a3e635] hover:text-[#08090c]'
                    }`}
                  >
                    {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    <span>{isSelected ? t.selectedCoach : t.bookConsult}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
