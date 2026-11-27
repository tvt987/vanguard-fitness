import React, { useMemo, useState } from 'react';
import type {
  ExperienceLevel,
  MuscleGroupId,
  PeriodizationGoal,
  PeriodizationInput,
  TrainingDaysPerWeek,
} from '../engines/periodizationEngine';
import {
  DEFAULT_1RM_BY_EXPERIENCE,
  exportPeriodizationCsv,
  exportPeriodizationMarkdown,
  generatePeriodizationPlan,
  MAX_SAFE_ACWR,
} from '../engines/periodizationEngine';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import {
  DownloadIcon,
  DumbbellIcon,
  FileTextIcon,
  GaugeIcon,
  LayersIcon,
  ShieldIcon,
  TrendingUpIcon,
} from './Icons';

interface PeriodizationBuilderLabProps {
  lang: Lang;
  input: PeriodizationInput;
  onChangeInput: (next: PeriodizationInput) => void;
}

const GOALS: PeriodizationGoal[] = [
  'hypertrophy_volume',
  'powerlifting_peaking',
  'hyrox_hybrid',
  'executive_recomp',
];

const DAYS_OPTIONS: TrainingDaysPerWeek[] = [3, 4, 5, 6];
const EXP_OPTIONS: ExperienceLevel[] = ['novice', 'intermediate', 'advanced'];

const MUSCLE_KEYS: MuscleGroupId[] = [
  'quads',
  'posterior_chain',
  'push',
  'pull',
  'core',
  'conditioning',
];

export const PeriodizationBuilderLab: React.FC<PeriodizationBuilderLabProps> = ({
  lang,
  input,
  onChangeInput,
}) => {
  const t = COPY[lang].periodization;
  const [selectedWeek, setSelectedWeek] = useState<number>(10);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(1);

  const plan = useMemo(
    () => generatePeriodizationPlan(input, selectedWeek),
    [input, selectedWeek]
  );

  // Clamp selected day when user switches from 6-day down to 3-day split
  const activeDayIndex = Math.min(selectedDayIdx, plan.weeklySplit.length);
  const activeDay =
    plan.weeklySplit[activeDayIndex - 1] ?? plan.weeklySplit[0];
  const activeWeekMetric =
    plan.weeks[plan.inspectedWeek - 1] ?? plan.weeks[0];

  const handleExperienceChange = (experience: ExperienceLevel) => {
    const defaults = DEFAULT_1RM_BY_EXPERIENCE[experience];
    onChangeInput({
      ...input,
      experience,
      oneRepMax: defaults,
    });
  };

  const handleOneRmChange = (
    lift: 'squatKg' | 'benchKg' | 'deadliftKg',
    rawValue: string
  ) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    onChangeInput({
      ...input,
      oneRepMax: {
        ...input.oneRepMax,
        [lift]: parsed,
      },
    });
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    triggerDownload(
      exportPeriodizationCsv(plan),
      `vanguard-12w-${input.goal}-${input.daysPerWeek}d.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportMd = () => {
    triggerDownload(
      exportPeriodizationMarkdown(plan),
      `vanguard-12w-${input.goal}-${input.daysPerWeek}d.md`,
      'text/markdown;charset=utf-8;'
    );
  };

  // Dual-axis SVG chart geometry (12-Week Volume Bars + Relative Intensity %1RM Curve)
  const chartW = 640;
  const chartH = 248;
  const padL = 42;
  const padR = 44;
  const padT = 26;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxSetsAxis = Math.ceil((plan.peakWeeklySets + 8) / 10) * 10;
  const minIntAxis = 50;
  const maxIntAxis = 100;

  const colStep = plotW / 12;
  const barW = Math.min(28, colStep * 0.54);

  const xCenterForWeek = (week: number) => padL + (week - 0.5) * colStep;
  const yForSets = (sets: number) =>
    padT + plotH - (sets / Math.max(1, maxSetsAxis)) * plotH;
  const yForIntensity = (pct: number) =>
    padT +
    plotH -
    ((pct - minIntAxis) / (maxIntAxis - minIntAxis)) * plotH;

  const intensityPath = plan.weeks
    .map(
      (w, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xCenterForWeek(w.week).toFixed(1)} ${yForIntensity(w.relativeIntensityPct).toFixed(1)}`
    )
    .join(' ');

  const avgDeloadDrop =
    plan.deloadDropPcts.reduce((s, d) => s + d, 0) /
    Math.max(1, plan.deloadDropPcts.length);

  const maxMuscleSets = Math.max(
    1,
    ...MUSCLE_KEYS.map((k) => plan.muscleGroupWeeklySets[k])
  );

  return (
    <section
      id="periodization-lab"
      data-testid="periodization-lab"
      className="no-print border-b border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/45 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header + Export Buttons */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-signal)]">
              {t.eyebrow}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--vg-muted)]">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="period-export-csv"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-ink)] cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>{t.exportCsv}</span>
            </button>
            <button
              type="button"
              data-testid="period-export-md"
              onClick={handleExportMd}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0a0d12] px-3.5 py-2 text-xs font-bold text-white transition-all hover:opacity-90 cursor-pointer dark:bg-[#a3e635] dark:text-[#08090c]"
            >
              <FileTextIcon className="h-3.5 w-3.5 text-[#a3e635] dark:text-[#08090c]" />
              <span>{t.exportMd}</span>
            </button>
          </div>
        </div>

        {/* Configuration + Chart Grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* LEFT: Builder Controls (5 cols) */}
          <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-sm sm:p-6 lg:col-span-5">
            {/* Training Goal */}
            <div>
              <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                {t.goalLabel}
              </span>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GOALS.map((goal) => {
                  const active = input.goal === goal;
                  return (
                    <button
                      key={goal}
                      type="button"
                      data-testid={`period-goal-${goal}`}
                      onClick={() => onChangeInput({ ...input, goal })}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#0a0d12] bg-[#0a0d12] text-white dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 text-[var(--vg-ink)] hover:border-[var(--vg-ink)]/50'
                      }`}
                    >
                      <span className="font-display text-sm font-bold leading-snug">
                        {t.goals[goal].label}
                      </span>
                      <span
                        className={`font-mono-num mt-1 text-[10px] ${
                          active
                            ? 'text-[#a3e635] dark:text-[#08090c]/80 font-semibold'
                            : 'text-[var(--vg-muted)]'
                        }`}
                      >
                        {t.goals[goal].sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Days / Week */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                  {t.daysLabel}
                </span>
                <span
                  data-testid="period-split-label"
                  className="font-mono-num text-[10px] font-bold text-[var(--vg-accent)]"
                >
                  {lang === 'en' ? plan.splitLabelEn : plan.splitLabelVi}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DAYS_OPTIONS.map((days) => {
                  const active = input.daysPerWeek === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      data-testid={`period-days-${days}`}
                      onClick={() =>
                        onChangeInput({ ...input, daysPerWeek: days })
                      }
                      className={`rounded-xl border px-2 py-2.5 text-center font-mono-num transition-all cursor-pointer ${
                        active
                          ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c] font-bold shadow-xs'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-ink)]/50'
                      }`}
                    >
                      <div className="text-base font-bold leading-none">
                        {days}
                      </div>
                      <div className="mt-1 text-[9px] tracking-wider uppercase opacity-80">
                        {t.daysUnit}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Experience Level */}
            <div className="mt-5">
              <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                {t.expLabel}
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {EXP_OPTIONS.map((exp) => {
                  const active = input.experience === exp;
                  return (
                    <button
                      key={exp}
                      type="button"
                      data-testid={`period-exp-${exp}`}
                      onClick={() => handleExperienceChange(exp)}
                      className={`rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[var(--vg-ink)] bg-[var(--vg-ink)] text-[var(--vg-bg)]'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-ink)]/50'
                      }`}
                    >
                      <div className="text-xs font-bold">
                        {t.experiences[exp].label}
                      </div>
                      <div className="font-mono-num mt-0.5 text-[9px] opacity-75">
                        {t.experiences[exp].sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional 1RM Barbell Inputs */}
            <div className="mt-5 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-4">
              <div className="flex items-center gap-1.5 font-mono-num text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-ink)]">
                <DumbbellIcon className="h-3.5 w-3.5 text-[var(--vg-signal)]" />
                <span>{t.oneRmLabel}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--vg-muted)]">
                {t.oneRmHint}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="period-1rm-squat"
                    className="block font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]"
                  >
                    {t.squat}
                  </label>
                  <input
                    id="period-1rm-squat"
                    data-testid="period-1rm-squat"
                    type="number"
                    min={30}
                    max={350}
                    step={2.5}
                    value={input.oneRepMax.squatKg}
                    onChange={(e) => handleOneRmChange('squatKg', e.target.value)}
                    className="font-mono-num mt-1 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 text-sm font-bold text-[var(--vg-ink)] outline-none focus:border-[var(--vg-signal)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="period-1rm-bench"
                    className="block font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]"
                  >
                    {t.bench}
                  </label>
                  <input
                    id="period-1rm-bench"
                    data-testid="period-1rm-bench"
                    type="number"
                    min={20}
                    max={260}
                    step={2.5}
                    value={input.oneRepMax.benchKg}
                    onChange={(e) => handleOneRmChange('benchKg', e.target.value)}
                    className="font-mono-num mt-1 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 text-sm font-bold text-[var(--vg-ink)] outline-none focus:border-[var(--vg-signal)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="period-1rm-deadlift"
                    className="block font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]"
                  >
                    {t.deadlift}
                  </label>
                  <input
                    id="period-1rm-deadlift"
                    data-testid="period-1rm-deadlift"
                    type="number"
                    min={40}
                    max={400}
                    step={2.5}
                    value={input.oneRepMax.deadliftKg}
                    onChange={(e) =>
                      handleOneRmChange('deadliftKg', e.target.value)
                    }
                    className="font-mono-num mt-1 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 text-sm font-bold text-[var(--vg-ink)] outline-none focus:border-[var(--vg-signal)]"
                  />
                </div>
              </div>
            </div>

            {/* Muscle-Group Balance Strip */}
            <div className="mt-5 border-t border-[var(--vg-border)] pt-4">
              <div className="flex items-center justify-between font-mono-num text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                <span>{t.muscleBalanceTitle}</span>
                <span className="text-[var(--vg-ink)]">
                  {t.pushPullLabel}:{' '}
                  <strong className="text-[var(--vg-accent)]">
                    {plan.pushToPullRatio.toFixed(2)}
                  </strong>
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {MUSCLE_KEYS.map((key) => {
                  const sets = plan.muscleGroupWeeklySets[key];
                  const pct = Math.round((sets / maxMuscleSets) * 100);
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/60 p-2"
                    >
                      <div className="font-mono-num truncate text-[9px] uppercase text-[var(--vg-muted)]">
                        {t.muscles[key]}
                      </div>
                      <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-ink)]">
                        {sets}
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--vg-border)]">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full rounded-full bg-[var(--vg-accent-bright)]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: 4 KPI Cards + Interactive 12-Week Volume vs Intensity SVG Curve (7 cols) */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            {/* 4 Safety & Peak KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 shadow-xs">
                <div className="flex items-center gap-1.5 font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]">
                  <LayersIcon className="h-3.5 w-3.5 text-[var(--vg-ink)]" />
                  <span>{t.kpiPeakSets}</span>
                </div>
                <div
                  data-testid="period-kpi-peak-sets"
                  className="font-mono-num mt-1.5 text-2xl font-bold text-[var(--vg-ink)]"
                >
                  {plan.peakWeeklySets}
                  <span className="ml-1 text-xs font-normal text-[var(--vg-muted)]">
                    sets
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 shadow-xs">
                <div className="flex items-center gap-1.5 font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]">
                  <TrendingUpIcon className="h-3.5 w-3.5 text-[var(--vg-signal)]" />
                  <span>{t.kpiPeakIntensity}</span>
                </div>
                <div
                  data-testid="period-kpi-peak-intensity"
                  className="font-mono-num mt-1.5 text-2xl font-bold text-[var(--vg-signal)]"
                >
                  {plan.peakIntensityPct}%
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 shadow-xs">
                <div className="flex items-center gap-1.5 font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]">
                  <ShieldIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                  <span>{t.kpiMaxAcwr}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span
                    data-testid="period-kpi-acwr"
                    className="font-mono-num text-2xl font-bold text-[var(--vg-accent)]"
                  >
                    {plan.peakAcwr.toFixed(2)}
                  </span>
                  <span className="font-mono-num text-[9px] font-bold text-[var(--vg-muted)]">
                    / {MAX_SAFE_ACWR.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 shadow-xs">
                <div className="flex items-center gap-1.5 font-mono-num text-[10px] font-semibold text-[var(--vg-muted)]">
                  <GaugeIcon className="h-3.5 w-3.5 text-[var(--vg-cryo)]" />
                  <span>{t.kpiDeloadDrop}</span>
                </div>
                <div className="font-mono-num mt-1.5 text-2xl font-bold text-[var(--vg-cryo)]">
                  {avgDeloadDrop.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Interactive SVG 12-Week Volume vs Intensity Progression Curve */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--vg-ink)] sm:text-lg">
                    {t.curveTitle}
                  </h3>
                  <p className="text-xs text-[var(--vg-muted)]">{t.curveSub}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono-num text-[10px]">
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-ink)]">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#0a0d12] dark:bg-[#a3e635]" />
                    {t.legendSets}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-cryo)]">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#0284c7]" />
                    {t.legendDeload}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-signal)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--vg-signal)]" />
                    {t.legendIntensity}
                  </span>
                </div>
              </div>

              <div className="mt-4 w-full overflow-hidden">
                <svg
                  data-testid="period-svg-chart"
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="h-auto w-full select-none"
                  role="img"
                  aria-label="12-Week Periodized Volume versus Intensity Progression Curve"
                >
                  {/* Mesocycle background dividers */}
                  {[0, 4, 8].map((startIdx, blockIdx) => {
                    const x0 = padL + startIdx * colStep;
                    const w = colStep * 4;
                    const label =
                      blockIdx === 0
                        ? 'MESO 1 · ACCUMULATION'
                        : blockIdx === 1
                          ? 'MESO 2 · INTENSIFICATION'
                          : 'MESO 3 · PEAK & DELOAD';
                    return (
                      <g key={blockIdx}>
                        {blockIdx % 2 === 1 && (
                          <rect
                            x={x0}
                            y={padT}
                            width={w}
                            height={plotH}
                            fill="currentColor"
                            fillOpacity="0.035"
                          />
                        )}
                        {blockIdx > 0 && (
                          <line
                            x1={x0}
                            x2={x0}
                            y1={padT - 12}
                            y2={padT + plotH}
                            stroke="currentColor"
                            strokeOpacity="0.18"
                            strokeDasharray="3 3"
                          />
                        )}
                        <text
                          x={x0 + w / 2}
                          y={14}
                          textAnchor="middle"
                          fill="currentColor"
                          fillOpacity="0.55"
                          fontSize="8.5"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Horizontal gridlines + Left (Sets) & Right (%1RM) axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                    const y = padT + plotH - frac * plotH;
                    const setsTick = Math.round(frac * maxSetsAxis);
                    const intTick = Math.round(
                      minIntAxis + frac * (maxIntAxis - minIntAxis)
                    );
                    return (
                      <g key={idx}>
                        <line
                          x1={padL}
                          x2={chartW - padR}
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          strokeOpacity="0.1"
                          strokeDasharray="3 4"
                        />
                        <text
                          x={padL - 7}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="currentColor"
                          fillOpacity="0.55"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {setsTick}
                        </text>
                        <text
                          x={chartW - padR + 7}
                          y={y + 3.5}
                          textAnchor="start"
                          fill="var(--vg-signal)"
                          fillOpacity="0.85"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {intTick}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Weekly Effective Sets Bars */}
                  {plan.weeks.map((w) => {
                    const cx = xCenterForWeek(w.week);
                    const yTop = yForSets(w.effectiveSets);
                    const barH = Math.max(4, padT + plotH - yTop);
                    const isSelected = w.week === plan.inspectedWeek;
                    const barFill = w.isDeload
                      ? 'var(--vg-cryo)'
                      : isSelected
                        ? '#a3e635'
                        : 'var(--vg-ink)';

                    return (
                      <g key={w.week} className="pointer-events-none">
                        {isSelected && (
                          <rect
                            x={cx - colStep / 2}
                            y={padT}
                            width={colStep}
                            height={plotH + 26}
                            fill="rgba(163,230,53,0.12)"
                          />
                        )}
                        <rect
                          x={cx - barW / 2}
                          y={yTop}
                          width={barW}
                          height={barH}
                          rx="4"
                          fill={barFill}
                          fillOpacity={w.isDeload ? 0.72 : isSelected ? 0.95 : 0.22}
                          stroke={isSelected ? 'var(--vg-ink)' : 'none'}
                          strokeWidth={isSelected ? 1.4 : 0}
                        />
                        <text
                          x={cx}
                          y={chartH - 12}
                          textAnchor="middle"
                          fill={
                            w.isDeload
                              ? 'var(--vg-cryo)'
                              : isSelected
                                ? 'var(--vg-ink)'
                                : 'currentColor'
                          }
                          fillOpacity={isSelected || w.isDeload ? 1 : 0.65}
                          fontSize="9.5"
                          fontWeight={isSelected || w.isDeload ? 700 : 500}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          W{w.week}
                        </text>
                        {w.isDeload && (
                          <text
                            x={cx}
                            y={chartH - 2}
                            textAnchor="middle"
                            fill="var(--vg-cryo)"
                            fontSize="7.5"
                            fontWeight="700"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            DL
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Relative Intensity (%1RM) Polyline */}
                  <path
                    data-testid="period-intensity-path"
                    d={intensityPath}
                    fill="none"
                    stroke="var(--vg-signal)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />

                  {/* Intensity Nodes */}
                  {plan.weeks.map((w) => {
                    const cx = xCenterForWeek(w.week);
                    const cy = yForIntensity(w.relativeIntensityPct);
                    const isSelected = w.week === plan.inspectedWeek;
                    return (
                      <circle
                        key={`pt-${w.week}`}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 5.2 : 3.2}
                        fill="var(--vg-signal)"
                        stroke="var(--vg-surface)"
                        strokeWidth="1.8"
                        className="pointer-events-none"
                      />
                    );
                  })}

                  {/* Top Interactive Hit-Target Layer for W1-W12 */}
                  {plan.weeks.map((w) => {
                    const cx = xCenterForWeek(w.week);
                    return (
                      <rect
                        key={`hit-${w.week}`}
                        data-testid={`period-week-btn-${w.week}`}
                        x={cx - colStep / 2}
                        y={padT}
                        width={colStep}
                        height={plotH + 26}
                        fill="transparent"
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect Week ${w.week} (${w.effectiveSets} sets, ${w.relativeIntensityPct}% 1RM)`}
                        onClick={() => setSelectedWeek(w.week)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedWeek(w.week);
                          }
                        }}
                        className="cursor-pointer outline-none"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Calibrated Week Live Telemetry Strip */}
              <div
                data-testid="period-active-week-strip"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3.5 py-2.5 font-mono-num text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#0a0d12] px-2 py-0.5 text-[10px] font-bold text-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]">
                    W{activeWeekMetric.week} ·{' '}
                    {lang === 'en'
                      ? activeWeekMetric.phaseLabelEn.toUpperCase()
                      : activeWeekMetric.phaseLabelVi.toUpperCase()}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      activeWeekMetric.isDeload
                        ? 'bg-[#0284c7]/15 text-[var(--vg-cryo)]'
                        : 'bg-[#a3e635]/20 text-[var(--vg-accent)]'
                    }`}
                  >
                    {activeWeekMetric.isDeload ? t.deloadBadge : t.buildBadge}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span>
                    SETS:{' '}
                    <strong className="text-[var(--vg-ink)]">
                      {activeWeekMetric.effectiveSets}
                    </strong>
                  </span>
                  <span>
                    %1RM:{' '}
                    <strong className="text-[var(--vg-signal)]">
                      {activeWeekMetric.relativeIntensityPct}%
                    </strong>
                  </span>
                  <span>
                    RPE:{' '}
                    <strong className="text-[var(--vg-ink)]">
                      {activeWeekMetric.targetRpe.toFixed(1)}
                    </strong>
                  </span>
                  <span>
                    ACWR:{' '}
                    <strong className="text-[var(--vg-accent)]">
                      {activeWeekMetric.acwr.toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-[var(--vg-muted)]">
                    SQ {activeWeekMetric.prescribedLoadsKg.squatKg}kg · BP{' '}
                    {activeWeekMetric.prescribedLoadsKg.benchKg}kg · DL{' '}
                    {activeWeekMetric.prescribedLoadsKg.deadliftKg}kg
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Mesocycle Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {plan.mesocycles.map((meso) => (
                <div
                  key={meso.phase}
                  className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between font-mono-num text-[10px]">
                    <span className="font-bold text-[var(--vg-signal)]">
                      {meso.weeksLabel}
                    </span>
                    <span className="rounded bg-[var(--vg-surface-alt)] px-1.5 py-0.5 font-semibold text-[var(--vg-cryo)]">
                      DL W{meso.deloadWeek}
                    </span>
                  </div>
                  <h4 className="font-display mt-1.5 text-sm font-bold text-[var(--vg-ink)]">
                    {lang === 'en' ? meso.titleEn : meso.titleVi}
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--vg-muted)]">
                    {lang === 'en' ? meso.objectiveEn : meso.objectiveVi}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-[var(--vg-border)] pt-2 font-mono-num text-[10px] font-semibold">
                    <span className="text-[var(--vg-ink)]">
                      ~{meso.avgEffectiveSets} sets/wk
                    </span>
                    <span className="text-[var(--vg-signal)]">
                      Peak {meso.peakIntensityPct}% 1RM
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Day-by-Day Exercise Split Breakdown */}
        <div className="mt-8 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-lg font-bold text-[var(--vg-ink)] sm:text-xl">
                {t.splitTitle}
              </h3>
              <p className="font-mono-num mt-0.5 text-[11px] text-[var(--vg-muted)]">
                {t.weekInspectTitle} W{plan.inspectedWeek} ·{' '}
                {lang === 'en' ? plan.splitLabelEn : plan.splitLabelVi}
              </p>
            </div>

            {/* Day Tabs */}
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Weekly training split days"
            >
              {plan.weeklySplit.map((day) => {
                const isSelected = day.dayIndex === activeDay.dayIndex;
                return (
                  <button
                    key={day.dayIndex}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    data-testid={`period-day-tab-${day.dayIndex}`}
                    onClick={() => setSelectedDayIdx(day.dayIndex)}
                    className={`rounded-lg border px-3 py-1.5 font-mono-num text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0a0d12] bg-[#0a0d12] text-[#a3e635] dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:border-[var(--vg-ink)] hover:text-[var(--vg-ink)]'
                    }`}
                  >
                    D{day.dayIndex} · {day.dayCode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Day Focus Banner */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-4 py-3">
            <div className="font-display text-sm font-bold text-[var(--vg-ink)] sm:text-base">
              Day {activeDay.dayIndex} ({activeDay.dayCode}) —{' '}
              {lang === 'en' ? activeDay.focusEn : activeDay.focusVi}
            </div>
            <div className="flex items-center gap-3 font-mono-num text-[11px] font-semibold text-[var(--vg-muted)]">
              <span className="text-[var(--vg-ink)]">
                {activeDay.totalSets} sets
              </span>
              <span>·</span>
              <span>~{activeDay.estDurationMin} min</span>
            </div>
          </div>

          {/* Responsive Exercise Breakdown Table */}
          <div className="mt-4 overflow-x-auto">
            <table
              data-testid="period-split-table"
              className="w-full min-w-[560px] border-collapse text-left text-xs"
            >
              <thead>
                <tr className="border-b border-[var(--vg-border)] font-mono-num text-[10px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                  <th className="py-2.5 pr-3">{t.colExercise}</th>
                  <th className="px-3 py-2.5">{t.colSetsReps}</th>
                  <th className="px-3 py-2.5">{t.colLoad}</th>
                  <th className="px-3 py-2.5">{t.colRpe}</th>
                  <th className="py-2.5 pl-3 text-right">{t.colRest}</th>
                </tr>
              </thead>
              <tbody>
                {activeDay.exercises.map((ex) => (
                  <tr
                    key={ex.id}
                    className="border-b border-[var(--vg-border)]/70 last:border-b-0"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-[var(--vg-ink)]">
                        {lang === 'en' ? ex.nameEn : ex.nameVi}
                      </div>
                      <span className="font-mono-num text-[10px] uppercase text-[var(--vg-muted)]">
                        {t.muscles[ex.muscleGroup]}
                      </span>
                    </td>
                    <td className="font-mono-num px-3 py-3 font-bold text-[var(--vg-ink)]">
                      {ex.sets} × {ex.reps}
                    </td>
                    <td className="font-mono-num px-3 py-3">
                      {ex.targetLoadKg !== null && ex.intensityPct1Rm !== null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded bg-[#a3e635]/20 px-2 py-0.5 font-bold text-[var(--vg-accent)]">
                            {ex.targetLoadKg} kg
                          </span>
                          <span className="text-[11px] text-[var(--vg-muted)]">
                            ({ex.intensityPct1Rm}% 1RM)
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--vg-muted)]">
                          RPE {ex.rpe.toFixed(1)} Auto
                        </span>
                      )}
                    </td>
                    <td className="font-mono-num px-3 py-3 font-semibold text-[var(--vg-ink)]">
                      {ex.rpe.toFixed(1)}
                    </td>
                    <td className="font-mono-num py-3 pl-3 text-right text-[var(--vg-muted)]">
                      {ex.restSec}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PeriodizationBuilderLab;
