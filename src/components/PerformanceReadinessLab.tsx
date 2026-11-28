import React, { useMemo, useState } from 'react';
import type {
  AthleteTier,
  ReadinessPresetId,
  ReadinessZonesInput,
  ReadinessZonesResult,
} from '../engines/readinessEngine';
import {
  computeTanakaMaxHr,
  exportReadinessCsv,
  READINESS_PRESETS,
} from '../engines/readinessEngine';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import {
  DownloadIcon,
  GaugeIcon,
  HeartPulseIcon,
  PulseIcon,
  ShieldIcon,
  SlidersIcon,
  ZapIcon,
} from './Icons';

interface PerformanceReadinessLabProps {
  lang: Lang;
  input: ReadinessZonesInput;
  result: ReadinessZonesResult;
  onChangeInput: (next: ReadinessZonesInput) => void;
}

const ATHLETE_TIERS: AthleteTier[] = [
  'executive_wellness',
  'hybrid_competitor',
  'marathon_elite',
];

const ZONE_ACCENT_STYLES: Record<
  'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5',
  { bar: string; badge: string; text: string }
> = {
  Z1: {
    bar: '#64748b',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    text: 'text-slate-600 dark:text-slate-300',
  },
  Z2: {
    bar: '#0284c7',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    text: 'text-[var(--vg-cryo)]',
  },
  Z3: {
    bar: '#65a30d',
    badge: 'bg-lime-500/20 text-lime-800 dark:text-lime-300',
    text: 'text-[var(--vg-accent)]',
  },
  Z4: {
    bar: '#d97706',
    badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
  },
  Z5: {
    bar: '#dc2626',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    text: 'text-[var(--vg-signal)]',
  },
};

export const PerformanceReadinessLab: React.FC<PerformanceReadinessLabProps> = ({
  lang,
  input,
  result,
  onChangeInput,
}) => {
  const t = COPY[lang].readiness;
  const [activePreset, setActivePreset] = useState<ReadinessPresetId | null>(
    null
  );
  const [selectedCurveIdx, setSelectedCurveIdx] = useState<number>(8); // 85% HRR near LT2
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(6); // Today

  const autoTanaka = useMemo(() => computeTanakaMaxHr(input.age), [input.age]);
  const isCustomMaxHr = input.customMaxHr !== null;

  const updateInput = (patch: Partial<ReadinessZonesInput>) => {
    setActivePreset(null);
    onChangeInput({ ...input, ...patch });
  };

  const applyPreset = (presetId: ReadinessPresetId) => {
    const found = READINESS_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePreset(presetId);
    onChangeInput({ ...found.input });
  };

  const handleExportCsv = () => {
    const csv = exportReadinessCsv(result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vanguard-v3-readiness-${result.athleteTier}-${result.readinessTier.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- SVG 1: Blood Lactate Curve Geometry (mmol/L vs % HRR) ---
  const lacW = 620;
  const lacH = 248;
  const lacPadL = 46;
  const lacPadR = 24;
  const lacPadT = 26;
  const lacPadB = 34;
  const lacPlotW = lacW - lacPadL - lacPadR;
  const lacPlotH = lacH - lacPadT - lacPadB;
  const maxLactateAxis = Math.max(
    10,
    Math.ceil(
      Math.max(...result.lactateCurve.map((p) => p.lactateMmol)) + 0.8
    )
  );

  const xForPct = (pct: number) =>
    lacPadL + ((pct - 45) / (100 - 45)) * lacPlotW;
  const yForLac = (mmol: number) =>
    lacPadT + lacPlotH - (mmol / maxLactateAxis) * lacPlotH;

  const lactatePathD = result.lactateCurve
    .map(
      (pt, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xForPct(pt.pctHrr).toFixed(1)} ${yForLac(pt.lactateMmol).toFixed(1)}`
    )
    .join(' ');

  const lactateAreaD = `${lactatePathD} L ${xForPct(100).toFixed(1)} ${(lacPadT + lacPlotH).toFixed(1)} L ${xForPct(45).toFixed(1)} ${(lacPadT + lacPlotH).toFixed(1)} Z`;

  const lt1X = xForPct(result.lt1.pctHrr);
  const lt1Y = yForLac(result.lt1.lactateMmol);
  const lt2X = xForPct(result.lt2.pctHrr);
  const lt2Y = yForLac(result.lt2.lactateMmol);

  const inspectedCurvePoint =
    result.lactateCurve[
      Math.min(selectedCurveIdx, result.lactateCurve.length - 1)
    ] ?? result.lactateCurve[0];

  // --- SVG 2: 7-Day HRV & ACWR Telemetry Sparkline Geometry ---
  const spW = 600;
  const spH = 196;
  const spPadL = 42;
  const spPadR = 44;
  const spPadT = 20;
  const spPadB = 28;
  const spPlotW = spW - spPadL - spPadR;
  const spPlotH = spH - spPadT - spPadB;
  const dayStep = spPlotW / 7;

  const hrvValues = result.telemetry7Day.map((d) => d.hrvMs);
  const maxHrvAxis = Math.max(100, Math.ceil((Math.max(...hrvValues) + 14) / 10) * 10);
  const minHrvAxis = Math.max(10, Math.floor((Math.min(...hrvValues) - 14) / 10) * 10);
  const minAcwrAxis = 0.4;
  const maxAcwrAxis = Math.max(1.8, Math.ceil((Math.max(...result.telemetry7Day.map((d) => d.acwr)) + 0.15) * 10) / 10);

  const xForDay = (idx: number) => spPadL + (idx + 0.5) * dayStep;
  const yForHrv = (hrv: number) =>
    spPadT +
    spPlotH -
    ((hrv - minHrvAxis) / Math.max(10, maxHrvAxis - minHrvAxis)) * spPlotH;
  const yForAcwr = (acwr: number) =>
    spPadT +
    spPlotH -
    ((acwr - minAcwrAxis) / Math.max(0.4, maxAcwrAxis - minAcwrAxis)) * spPlotH;

  const acwrPathD = result.telemetry7Day
    .map(
      (d, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xForDay(idx).toFixed(1)} ${yForAcwr(d.acwr).toFixed(1)}`
    )
    .join(' ');

  const hrvLineD = result.telemetry7Day
    .map(
      (d, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xForDay(idx).toFixed(1)} ${yForHrv(d.hrvMs).toFixed(1)}`
    )
    .join(' ');

  const inspectedDay =
    result.telemetry7Day[
      Math.min(selectedDayIdx, result.telemetry7Day.length - 1)
    ] ?? result.telemetry7Day[6];

  // --- Tier Colors (GREEN / AMBER / RED) ---
  const tierPalette =
    result.readinessTier === 'GREEN'
      ? {
          ring: '#84cc16',
          badge:
            'border-lime-600/30 bg-lime-500/15 text-lime-800 dark:border-[#a3e635]/40 dark:bg-[#a3e635]/15 dark:text-[#a3e635]',
          cardBorder: 'border-lime-600/35 dark:border-[#a3e635]/40',
          accentText: 'text-lime-700 dark:text-[#a3e635]',
          dot: 'bg-[#a3e635]',
        }
      : result.readinessTier === 'AMBER'
        ? {
            ring: '#f59e0b',
            badge:
              'border-amber-500/35 bg-amber-500/15 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300',
            cardBorder: 'border-amber-500/40 dark:border-amber-400/45',
            accentText: 'text-amber-700 dark:text-amber-400',
            dot: 'bg-amber-400',
          }
        : {
            ring: '#ef4444',
            badge:
              'border-rose-600/35 bg-rose-500/15 text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300',
            cardBorder: 'border-rose-600/40 dark:border-rose-500/45',
            accentText: 'text-rose-700 dark:text-rose-400',
            dot: 'bg-rose-500',
          };

  // ACWR horizontal needle percent (0.40 .. 2.00)
  const acwrNeedlePct = Math.min(
    98,
    Math.max(2, ((result.acwr - 0.4) / (2.0 - 0.4)) * 100)
  );

  // Readiness ring circumference (r = 42 -> 2 * pi * 42 = 263.89)
  const ringCirc = 263.89;
  const ringOffset = ringCirc * (1 - result.compositeReadinessScore / 100);

  return (
    <section
      id="readiness-lab"
      data-testid="readiness-lab"
      className="no-print border-b border-[var(--vg-border)] bg-[var(--vg-bg)] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header + Quick Athlete Presets + CSV Export */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
              <HeartPulseIcon className="h-3.5 w-3.5" />
              <span>{t.eyebrow}</span>
            </div>
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
              data-testid="readiness-export-csv"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-ink)] cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>{t.exportCsv}</span>
            </button>
          </div>
        </div>

        {/* Quick Athlete Presets Bar */}
        <div className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 font-mono-num text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--vg-muted)]">
            <ZapIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
            <span>{t.presetsLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {READINESS_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              const pillAccent =
                preset.id === 'peak_race_taper'
                  ? 'bg-[#a3e635]'
                  : preset.id === 'executive_jetlag_recovery'
                    ? 'bg-amber-400'
                    : 'bg-rose-500';
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`readiness-preset-${preset.id}`}
                  onClick={() => applyPreset(preset.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--vg-ink)] bg-[var(--vg-ink)] text-[var(--vg-bg)] shadow-xs'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-ink)]/60'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${pillAccent}`} />
                  <span>{lang === 'en' ? preset.labelEn : preset.labelVi}</span>
                  <span
                    className={`font-mono-num text-[9px] font-bold ${
                      isSelected ? 'opacity-80' : 'text-[var(--vg-muted)]'
                    }`}
                  >
                    {lang === 'en' ? preset.tagEn : preset.tagVi}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODULE A: KARVONEN Z1-Z5, VO2 MAX & BLOOD LACTATE CURVE        */}
        {/* ============================================================== */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* LEFT (5 cols): Heart-Rate Controls + VO2 Max + 80/20 Polarized Bar */}
          <div className="min-w-0 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-[var(--vg-ink)] sm:text-lg">
                  {t.moduleATitle}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--vg-muted)]">
                  {t.moduleASub}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 font-mono-num text-[10px] font-bold text-[var(--vg-accent)]">
                MAX {result.maxHr} BPM
              </span>
            </div>

            {/* Age & Resting HR Sliders */}
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-age"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.ageLabel}
                  </label>
                  <span
                    data-testid="readiness-age-val"
                    className="font-mono-num font-bold text-[var(--vg-ink)]"
                  >
                    {input.age} yrs
                  </span>
                </div>
                <input
                  id="readiness-age"
                  data-testid="readiness-age-slider"
                  type="range"
                  min={18}
                  max={75}
                  step={1}
                  value={input.age}
                  onChange={(e) => updateInput({ age: Number(e.target.value) })}
                  className="vg-slider mt-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-rhr"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.rhrLabel}
                  </label>
                  <span
                    data-testid="readiness-rhr-val"
                    className="font-mono-num font-bold text-[var(--vg-cryo)]"
                  >
                    {input.restingHr} bpm
                  </span>
                </div>
                <input
                  id="readiness-rhr"
                  data-testid="readiness-rhr-slider"
                  type="range"
                  min={38}
                  max={90}
                  step={1}
                  value={input.restingHr}
                  onChange={(e) =>
                    updateInput({ restingHr: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* Max HR Mode: Auto Tanaka vs Custom Override */}
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/75 p-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono-num text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                    {t.maxHrLabel}
                  </span>
                  <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 font-mono-num text-[10px] sm:flex sm:w-auto sm:items-center">
                    <button
                      type="button"
                      data-testid="readiness-maxhr-auto"
                      onClick={() => updateInput({ customMaxHr: null })}
                      className={`whitespace-nowrap rounded px-2 py-1 text-center font-semibold transition-colors cursor-pointer ${
                        !isCustomMaxHr
                          ? 'bg-[#a3e635] text-[#08090c]'
                          : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
                      }`}
                    >
                      {t.maxHrAuto} ({autoTanaka})
                    </button>
                    <button
                      type="button"
                      data-testid="readiness-maxhr-custom"
                      onClick={() =>
                        updateInput({
                          customMaxHr: input.customMaxHr ?? autoTanaka + 4,
                        })
                      }
                      className={`whitespace-nowrap rounded px-2 py-1 text-center font-semibold transition-colors cursor-pointer ${
                        isCustomMaxHr
                          ? 'bg-[#0a0d12] text-white dark:bg-[#a3e635] dark:text-[#08090c]'
                          : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
                      }`}
                    >
                      {t.maxHrCustom}
                    </button>
                  </div>
                </div>

                {isCustomMaxHr && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <input
                      data-testid="readiness-maxhr-input"
                      type="number"
                      min={130}
                      max={225}
                      step={1}
                      value={input.customMaxHr ?? autoTanaka}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          updateInput({ customMaxHr: val });
                        }
                      }}
                      aria-label="Custom Max HR in BPM"
                      className="font-mono-num w-24 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 text-sm font-bold text-[var(--vg-ink)] outline-none focus:border-[var(--vg-accent)]"
                    />
                    <span className="font-mono-num text-[11px] text-[var(--vg-muted)]">
                      bpm · {t.hrrLabel}:{' '}
                      <strong className="text-[var(--vg-ink)]">
                        {result.heartRateReserve} bpm
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Athlete Tier Selector */}
              <div>
                <span className="font-mono-num text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                  {t.tierLabel}
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ATHLETE_TIERS.map((tier) => {
                    const active = input.athleteTier === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        data-testid={`readiness-tier-${tier}`}
                        onClick={() => updateInput({ athleteTier: tier })}
                        className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#0a0d12] bg-[#0a0d12] text-white dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                            : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 text-[var(--vg-ink)] hover:border-[var(--vg-ink)]/50'
                        }`}
                      >
                        <div className="text-xs font-bold leading-snug">
                          {t.tiers[tier].label}
                        </div>
                        <div
                          className={`font-mono-num mt-1 text-[9px] ${
                            active
                              ? 'text-[#a3e635] dark:text-[#08090c]/80 font-semibold'
                              : 'text-[var(--vg-muted)]'
                          }`}
                        >
                          {t.tiers[tier].sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* VO2 Max & Polarized 80/20 Summary Box */}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--vg-border)] pt-5">
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-3.5">
                <div className="font-mono-num text-[9px] font-bold tracking-[0.14em] text-[var(--vg-muted)]">
                  {t.vo2Label}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    data-testid="readiness-vo2-val"
                    className="font-mono-num text-2xl font-bold text-[var(--vg-ink)]"
                  >
                    {result.vo2MaxMlKgMin.toFixed(1)}
                  </span>
                  <span className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    {t.vo2Unit}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 font-mono-num text-[10px]">
                  <span className="rounded bg-[#a3e635]/20 px-1.5 py-0.5 font-bold text-[var(--vg-accent)]">
                    {result.vo2Rating.toUpperCase()}
                  </span>
                  <span className="text-[var(--vg-muted)]">
                    P{result.vo2Percentile}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-3.5">
                <div className="font-mono-num text-[9px] font-bold tracking-[0.14em] text-[var(--vg-muted)]">
                  {t.hrrLabel}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono-num text-2xl font-bold text-[var(--vg-cryo)]">
                    {result.heartRateReserve}
                  </span>
                  <span className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    bpm
                  </span>
                </div>
                <div className="font-mono-num mt-1.5 text-[10px] text-[var(--vg-muted)]">
                  LT1 <strong className="text-[var(--vg-cryo)]">{result.lt1.bpm}</strong> · LT2{' '}
                  <strong className="text-[var(--vg-signal)]">{result.lt2.bpm}</strong>
                </div>
              </div>
            </div>

            {/* Seiler 80/20 Polarized Weekly Minute Split Bar */}
            <div className="mt-4 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/55 p-3.5">
              <div className="flex items-center justify-between font-mono-num text-[10px] font-bold">
                <span className="uppercase tracking-[0.1em] text-[var(--vg-ink)]">
                  {t.polarizedTitle}
                </span>
                <span
                  data-testid="readiness-polarized-total"
                  className="text-[var(--vg-accent)]"
                >
                  {result.polarizedSplit.totalWeeklyMinutes} min / wk
                </span>
              </div>

              <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--vg-border)]">
                <div
                  style={{ width: '80%' }}
                  className="h-full bg-[#0284c7] transition-all duration-300"
                  title={t.lowZoneLabel}
                />
                <div
                  style={{ width: '5%' }}
                  className="h-full bg-[#84cc16] transition-all duration-300"
                  title={t.tempoZoneLabel}
                />
                <div
                  style={{ width: '15%' }}
                  className="h-full bg-[#dc2626] transition-all duration-300"
                  title={t.highZoneLabel}
                />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 font-mono-num text-[10px]">
                <div>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0284c7] mr-1" />
                  <span className="text-[var(--vg-muted)]">Z1–Z2:</span>{' '}
                  <strong className="text-[var(--vg-ink)]">
                    {result.polarizedSplit.lowIntensityMinutes}m
                  </strong>
                </div>
                <div>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#84cc16] mr-1" />
                  <span className="text-[var(--vg-muted)]">Z3:</span>{' '}
                  <strong className="text-[var(--vg-ink)]">
                    {result.polarizedSplit.tempoMinutes}m
                  </strong>
                </div>
                <div className="text-right">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#dc2626] mr-1" />
                  <span className="text-[var(--vg-muted)]">Z4–Z5:</span>{' '}
                  <strong className="text-[var(--vg-ink)]">
                    {result.polarizedSplit.highIntensityMinutes}m
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT (7 cols): Animated SVG Blood Lactate Curve + Karvonen Z1-Z5 Table */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
            {/* SVG Blood Lactate Curve Card */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--vg-ink)] sm:text-lg">
                    {t.lactateTitle}
                  </h3>
                  <p className="text-xs text-[var(--vg-muted)]">
                    {t.lactateSub}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono-num text-[10px]">
                  <span
                    data-testid="readiness-lt1-badge"
                    className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-bold text-[var(--vg-cryo)]"
                  >
                    LT1 · 2.0 mmol · {result.lt1.bpm} bpm
                  </span>
                  <span
                    data-testid="readiness-lt2-badge"
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-bold text-[var(--vg-signal)]"
                  >
                    LT2 · 4.0 mmol · {result.lt2.bpm} bpm
                  </span>
                </div>
              </div>

              <div className="mt-4 w-full overflow-hidden">
                <svg
                  data-testid="readiness-lactate-svg"
                  viewBox={`0 0 ${lacW} ${lacH}`}
                  className="h-auto w-full select-none"
                  role="img"
                  aria-label="Blood Lactate Curve showing LT1 2.0 mmol/L and LT2 4.0 mmol/L thresholds"
                >
                  <defs>
                    <linearGradient
                      id="vgLactateFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--vg-signal)"
                        stopOpacity="0.28"
                      />
                      <stop
                        offset="55%"
                        stopColor="var(--vg-cryo)"
                        stopOpacity="0.10"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--vg-cryo)"
                        stopOpacity="0.01"
                      />
                    </linearGradient>
                  </defs>

                  {/* Zone background columns (Z1-Z5) */}
                  {[
                    { code: 'Z1', start: 50, end: 60, op: 0.03 },
                    { code: 'Z2', start: 60, end: 70, op: 0.055 },
                    { code: 'Z3', start: 70, end: 80, op: 0.03 },
                    { code: 'Z4', start: 80, end: 90, op: 0.06 },
                    { code: 'Z5', start: 90, end: 100, op: 0.085 },
                  ].map((band) => {
                    const bx = xForPct(band.start);
                    const bw = xForPct(band.end) - bx;
                    return (
                      <g key={band.code}>
                        <rect
                          x={bx}
                          y={lacPadT}
                          width={bw}
                          height={lacPlotH}
                          fill={
                            band.code === 'Z5'
                              ? 'var(--vg-signal)'
                              : band.code === 'Z2'
                                ? 'var(--vg-cryo)'
                                : 'currentColor'
                          }
                          fillOpacity={band.op}
                        />
                        <text
                          x={bx + bw / 2}
                          y={16}
                          textAnchor="middle"
                          fill="currentColor"
                          fillOpacity="0.55"
                          fontSize="9"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {band.code}
                        </text>
                      </g>
                    );
                  })}

                  {/* Horizontal Y-Axis gridlines (mmol/L) */}
                  {[0, 2, 4, 6, 8, 10].map((tick) => {
                    if (tick > maxLactateAxis) return null;
                    const y = yForLac(tick);
                    const isLt1 = tick === 2;
                    const isLt2 = tick === 4;
                    return (
                      <g key={tick}>
                        <line
                          x1={lacPadL}
                          x2={lacW - lacPadR}
                          y1={y}
                          y2={y}
                          stroke={
                            isLt2
                              ? 'var(--vg-signal)'
                              : isLt1
                                ? 'var(--vg-cryo)'
                                : 'currentColor'
                          }
                          strokeOpacity={isLt1 || isLt2 ? 0.6 : 0.12}
                          strokeWidth={isLt1 || isLt2 ? 1.3 : 1}
                          strokeDasharray={isLt1 || isLt2 ? '5 4' : '2 4'}
                        />
                        <text
                          x={lacPadL - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill={
                            isLt2
                              ? 'var(--vg-signal)'
                              : isLt1
                                ? 'var(--vg-cryo)'
                                : 'currentColor'
                          }
                          fillOpacity={isLt1 || isLt2 ? 0.95 : 0.55}
                          fontSize="9.5"
                          fontWeight={isLt1 || isLt2 ? 700 : 500}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {tick.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Y-axis unit */}
                  <text
                    x={lacPadL - 8}
                    y={lacPadT - 9}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity="0.5"
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    mmol/L
                  </text>

                  {/* Gradient Area + Lactate Curve Path */}
                  <path
                    d={lactateAreaD}
                    fill="url(#vgLactateFill)"
                    className="transition-all duration-300"
                  />
                  <path
                    data-testid="readiness-lactate-path"
                    d={lactatePathD}
                    fill="none"
                    stroke="var(--vg-ink)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />

                  {/* LT1 Turnpoint Vertical Guide + Pin */}
                  <line
                    x1={lt1X}
                    x2={lt1X}
                    y1={lt1Y}
                    y2={lacPadT + lacPlotH}
                    stroke="var(--vg-cryo)"
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={lt1X}
                    cy={lt1Y}
                    r="8"
                    fill="var(--vg-cryo)"
                    fillOpacity="0.2"
                  />
                  <circle
                    cx={lt1X}
                    cy={lt1Y}
                    r="4.5"
                    fill="var(--vg-cryo)"
                    stroke="var(--vg-surface)"
                    strokeWidth="1.8"
                  />
                  <text
                    x={lt1X}
                    y={lt1Y - 12}
                    textAnchor="middle"
                    fill="var(--vg-cryo)"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    LT1 ({result.lt1.pctHrr}%)
                  </text>

                  {/* LT2 Turnpoint Vertical Guide + Pin */}
                  <line
                    x1={lt2X}
                    x2={lt2X}
                    y1={lt2Y}
                    y2={lacPadT + lacPlotH}
                    stroke="var(--vg-signal)"
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={lt2X}
                    cy={lt2Y}
                    r="9"
                    fill="var(--vg-signal)"
                    fillOpacity="0.22"
                  />
                  <circle
                    cx={lt2X}
                    cy={lt2Y}
                    r="4.8"
                    fill="var(--vg-signal)"
                    stroke="var(--vg-surface)"
                    strokeWidth="1.8"
                  />
                  <text
                    x={lt2X - 4}
                    y={lt2Y - 13}
                    textAnchor="end"
                    fill="var(--vg-signal)"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    LT2 ({result.lt2.pctHrr}%)
                  </text>

                  {/* Interactive Curve Sample Nodes & X-Axis Labels */}
                  {result.lactateCurve.map((pt, idx) => {
                    const cx = xForPct(pt.pctHrr);
                    const cy = yForLac(pt.lactateMmol);
                    const isSelected = idx === selectedCurveIdx;
                    return (
                      <g key={pt.pctHrr}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 5 : 2.8}
                          fill={isSelected ? '#a3e635' : 'var(--vg-ink)'}
                          stroke="var(--vg-surface)"
                          strokeWidth="1.5"
                          className="pointer-events-none"
                        />
                        {pt.pctHrr % 10 === 0 && (
                          <text
                            x={cx}
                            y={lacH - 10}
                            textAnchor="middle"
                            fill="currentColor"
                            fillOpacity="0.6"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {pt.pctHrr}%
                          </text>
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="12"
                          fill="transparent"
                          role="button"
                          tabIndex={0}
                          aria-label={`${pt.pctHrr}% HRR, ${pt.bpm} BPM, ${pt.lactateMmol} mmol/L`}
                          onClick={() => setSelectedCurveIdx(idx)}
                          onMouseEnter={() => setSelectedCurveIdx(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCurveIdx(idx);
                            }
                          }}
                          className="cursor-pointer outline-none"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Inspected Lactate Node Readout Strip */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3.5 py-2 font-mono-num text-xs">
                <span className="font-bold text-[var(--vg-ink)]">
                  {inspectedCurvePoint.zoneCode} · {inspectedCurvePoint.pctHrr}%
                  HRR
                </span>
                <div className="flex flex-wrap items-center gap-4 text-[11px]">
                  <span>
                    BPM:{' '}
                    <strong className="text-[var(--vg-ink)]">
                      {inspectedCurvePoint.bpm}
                    </strong>
                  </span>
                  <span>
                    LACTATE:{' '}
                    <strong className="text-[var(--vg-signal)]">
                      {inspectedCurvePoint.lactateMmol.toFixed(2)} mmol/L
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Karvonen 5-Zone BPM Bands Table */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-[var(--vg-ink)]">
                  {t.zonesTitle}
                </h3>
                <span className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                  KARVONEN · RHR {result.restingHr} → MAX {result.maxHr}
                </span>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--vg-border)] font-mono-num text-[10px] uppercase text-[var(--vg-muted)]">
                      <th className="py-2 pr-2 font-semibold">{t.colZone}</th>
                      <th className="py-2 px-2 font-semibold">{t.colHrr}</th>
                      <th className="py-2 px-2 font-semibold">{t.colBpm}</th>
                      <th className="py-2 px-2 font-semibold">{t.colWeekly}</th>
                      <th className="py-2 pl-2 text-right font-semibold">
                        {t.colLactate}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--vg-border)]/70">
                    {result.zones.map((z) => {
                      const style = ZONE_ACCENT_STYLES[z.code];
                      return (
                        <tr
                          key={z.code}
                          data-testid={`karvonen-zone-${z.code}`}
                          className="transition-colors hover:bg-[var(--vg-surface-alt)]/60"
                        >
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex w-8 justify-center rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold ${style.badge}`}
                              >
                                {z.code}
                              </span>
                              <div>
                                <div className="font-semibold text-[var(--vg-ink)]">
                                  {lang === 'en' ? z.nameEn : z.nameVi}
                                </div>
                                <div className="text-[10px] text-[var(--vg-muted)]">
                                  {lang === 'en'
                                    ? z.fuelSystemEn
                                    : z.fuelSystemVi}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono-num text-[11px] text-[var(--vg-muted)]">
                            {z.pctHrrMin}–{z.pctHrrMax}%
                          </td>
                          <td className="py-2.5 px-2 font-mono-num font-bold text-[var(--vg-ink)]">
                            {z.minBpm}–{z.maxBpm} bpm
                          </td>
                          <td className="py-2.5 px-2 font-mono-num">
                            <span className="font-bold text-[var(--vg-ink)]">
                              {z.weeklyMinutes}m
                            </span>
                            <span className="ml-1 text-[10px] text-[var(--vg-muted)]">
                              ({z.weeklySharePct}%)
                            </span>
                          </td>
                          <td
                            className={`py-2.5 pl-2 text-right font-mono-num text-[11px] font-semibold ${style.text}`}
                          >
                            {z.lactateRangeMmol}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODULE B: AUTONOMIC HRV (rMSSD) & ACWR READINESS ENGINE        */}
        {/* ============================================================== */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* LEFT (5 cols): HRV, Sleep, ACWR & Subjective Sliders */}
          <div className="min-w-0 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6 lg:col-span-5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] p-2 text-[var(--vg-accent)]">
                <SlidersIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[var(--vg-ink)] sm:text-lg">
                  {t.moduleBTitle}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--vg-muted)]">
                  {t.moduleBSub}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Today's HRV */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-hrv-today"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.hrvTodayLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.hrvTodayMs} ms
                  </span>
                </div>
                <input
                  id="readiness-hrv-today"
                  data-testid="readiness-hrv-today-slider"
                  type="range"
                  min={15}
                  max={180}
                  step={1}
                  value={input.hrvTodayMs}
                  onChange={(e) =>
                    updateInput({ hrvTodayMs: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* 28-Day Baseline HRV */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-hrv-base"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.hrvBaseLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-muted)]">
                    {input.hrvBaselineMs} ms
                  </span>
                </div>
                <input
                  id="readiness-hrv-base"
                  data-testid="readiness-hrv-base-slider"
                  type="range"
                  min={20}
                  max={160}
                  step={1}
                  value={input.hrvBaselineMs}
                  onChange={(e) =>
                    updateInput({ hrvBaselineMs: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* Sleep Hours */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-sleep"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.sleepLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-cryo)]">
                    {input.sleepHours.toFixed(1)} hrs
                  </span>
                </div>
                <input
                  id="readiness-sleep"
                  data-testid="readiness-sleep-slider"
                  type="range"
                  min={4.0}
                  max={9.5}
                  step={0.1}
                  value={input.sleepHours}
                  onChange={(e) =>
                    updateInput({ sleepHours: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* 7-Day Acute Load AU */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-acute"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.acuteLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.acuteLoadAu.toLocaleString('en-US')} AU
                  </span>
                </div>
                <input
                  id="readiness-acute"
                  data-testid="readiness-acute-slider"
                  type="range"
                  min={400}
                  max={5000}
                  step={50}
                  value={input.acuteLoadAu}
                  onChange={(e) =>
                    updateInput({ acuteLoadAu: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* 28-Day Chronic Weekly Avg AU */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-chronic"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.chronicLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-muted)]">
                    {input.chronicLoadAu.toLocaleString('en-US')} AU
                  </span>
                </div>
                <input
                  id="readiness-chronic"
                  data-testid="readiness-chronic-slider"
                  type="range"
                  min={500}
                  max={4000}
                  step={50}
                  value={input.chronicLoadAu}
                  onChange={(e) =>
                    updateInput({ chronicLoadAu: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              {/* Subjective Readiness 1-10 */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="readiness-subjective"
                    className="font-medium text-[var(--vg-muted)]"
                  >
                    {t.subjectiveLabel}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-accent)]">
                    {input.subjectiveReadiness} / 10
                  </span>
                </div>
                <input
                  id="readiness-subjective"
                  data-testid="readiness-subjective-slider"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={input.subjectiveReadiness}
                  onChange={(e) =>
                    updateInput({ subjectiveReadiness: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>
            </div>
          </div>

          {/* RIGHT (7 cols): Readiness Ring + Auto-Prescription + ACWR Gauge + 7-Day Sparkline */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
            {/* WHOOP-Grade Composite Readiness + Auto-Prescription Card */}
            <div
              data-testid="readiness-prescription-card"
              className={`rounded-2xl border bg-[var(--vg-surface)] p-5 shadow-xs sm:p-6 ${tierPalette.cardBorder}`}
            >
              <div className="grid items-center gap-5 sm:grid-cols-12">
                {/* Radial Score Ring */}
                <div className="flex items-center gap-4 sm:col-span-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="var(--vg-border)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={tierPalette.ring}
                        strokeWidth="8"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        data-testid="readiness-composite-score"
                        className="font-mono-num text-2xl font-bold leading-none text-[var(--vg-ink)]"
                      >
                        {result.compositeReadinessScore}
                      </span>
                      <span className="font-mono-num mt-0.5 text-[9px] font-bold tracking-[0.14em] text-[var(--vg-muted)]">
                        / 100
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono-num text-[9px] font-bold tracking-[0.14em] text-[var(--vg-muted)]">
                      {t.readinessRingLabel}
                    </div>
                    <span
                      data-testid="readiness-tier-badge"
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono-num text-xs font-bold ${tierPalette.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${tierPalette.dot}`} />
                      {result.readinessTier}
                    </span>
                    <div className="font-mono-num mt-1.5 text-[10px] text-[var(--vg-muted)]">
                      {t.volumeModLabel}:{' '}
                      <strong className="text-[var(--vg-ink)]">
                        {result.prescription.volumeModifierPct}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Deterministic Daily Session Auto-Prescription */}
                <div className="border-t border-[var(--vg-border)] pt-4 sm:col-span-8 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <div className="font-mono-num text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                    {t.prescriptionTitle}
                  </div>
                  <div
                    data-testid="readiness-prescription-headline"
                    className={`font-display mt-1 text-lg font-bold leading-snug ${tierPalette.accentText}`}
                  >
                    {lang === 'en'
                      ? result.prescription.headlineEn
                      : result.prescription.headlineVi}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--vg-muted)]">
                    {lang === 'en'
                      ? result.prescription.detailEn
                      : result.prescription.detailVi}
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 font-mono-num text-[10px] font-semibold text-[var(--vg-ink)]">
                    <PulseIcon className="h-3 w-3 text-[var(--vg-accent)]" />
                    <span>
                      {t.targetBandLabel}:{' '}
                      <strong>
                        {lang === 'en'
                          ? result.prescription.targetZoneEn
                          : result.prescription.targetZoneVi}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* ACWR 4-Band Gauge + HRV Z-Delta Strip */}
              <div className="mt-5 grid gap-4 border-t border-[var(--vg-border)] pt-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <div className="flex items-center justify-between font-mono-num text-[10px]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[var(--vg-muted)]">
                      <ShieldIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                      {t.acwrRatioLabel}:{' '}
                      <strong
                        data-testid="readiness-acwr-val"
                        className="text-xs text-[var(--vg-ink)]"
                      >
                        {result.acwr.toFixed(2)}
                      </strong>
                    </span>
                    <span
                      data-testid="readiness-acwr-band"
                      className={`font-bold ${
                        result.acwrBand === 'optimal'
                          ? 'text-[var(--vg-accent)]'
                          : result.acwrBand === 'high_injury_risk'
                            ? 'text-[var(--vg-signal)]'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {lang === 'en' ? result.acwrLabelEn : result.acwrLabelVi}
                    </span>
                  </div>

                  {/* 4-Band Bar (0.40 -> 0.80 -> 1.30 -> 1.50 -> 2.00) */}
                  <div className="relative mt-2.5 h-3 w-full overflow-hidden rounded-full bg-[var(--vg-surface-alt)]">
                    <div className="flex h-full w-full">
                      {/* <0.80: 25% of [0.4..2.0] */}
                      <div className="h-full w-[25%] bg-sky-500/45" />
                      {/* 0.80-1.30: 31.25% */}
                      <div className="h-full w-[31.25%] bg-[#84cc16]/75" />
                      {/* 1.31-1.50: 12.5% */}
                      <div className="h-full w-[12.5%] bg-amber-400/80" />
                      {/* >1.50: 31.25% */}
                      <div className="h-full w-[31.25%] bg-rose-500/80" />
                    </div>
                    <div
                      style={{ left: `${acwrNeedlePct}%` }}
                      className="absolute top-0 bottom-0 w-1 -translate-x-1/2 rounded-full bg-[#0a0d12] ring-2 ring-white dark:bg-white dark:ring-[#08090c] transition-all duration-300"
                    />
                  </div>
                  <div className="mt-1 flex justify-between font-mono-num text-[9px] text-[var(--vg-muted)]">
                    <span>0.40</span>
                    <span>0.80</span>
                    <span>1.30</span>
                    <span>1.50</span>
                    <span>2.00</span>
                  </div>
                </div>

                {/* HRV Z-Delta KPI */}
                <div className="flex flex-col justify-center rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 px-3.5 py-2.5 sm:col-span-4">
                  <div className="flex items-center gap-1.5 font-mono-num text-[9px] font-bold text-[var(--vg-muted)]">
                    <GaugeIcon className="h-3 w-3 text-[var(--vg-cryo)]" />
                    <span>{t.hrvDeltaLabel}</span>
                  </div>
                  <div
                    data-testid="readiness-hrv-delta"
                    className={`font-mono-num mt-1 text-xl font-bold ${
                      result.hrvDeltaPct >= 0
                        ? 'text-[var(--vg-accent)]'
                        : result.hrvDeltaPct <= -15
                          ? 'text-[var(--vg-signal)]'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {result.hrvDeltaPct >= 0 ? '+' : ''}
                    {result.hrvDeltaPct.toFixed(1)}%
                  </div>
                  <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    {result.hrvTodayMs} vs {result.hrvBaselineMs} ms
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day SVG HRV & ACWR Telemetry Sparkline Chart */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-[var(--vg-ink)] sm:text-base">
                    {t.sparklineTitle}
                  </h3>
                  <p className="text-[11px] text-[var(--vg-muted)]">
                    {t.sparklineSub}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono-num text-[10px]">
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-cryo)]">
                    <span className="h-2 w-2 rounded-xs bg-[#0284c7]" />
                    {t.legendHrv}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-signal)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--vg-signal)]" />
                    {t.legendAcwr}
                  </span>
                </div>
              </div>

              <div className="mt-3 w-full overflow-hidden">
                <svg
                  data-testid="readiness-sparkline-svg"
                  viewBox={`0 0 ${spW} ${spH}`}
                  className="h-auto w-full select-none"
                  role="img"
                  aria-label="7-Day HRV rMSSD and ACWR Telemetry Sparkline Chart"
                >
                  {/* Optimal ACWR Sweet Spot Shaded Band (0.80 - 1.30) */}
                  <rect
                    x={spPadL}
                    y={yForAcwr(1.3)}
                    width={spPlotW}
                    height={Math.max(4, yForAcwr(0.8) - yForAcwr(1.3))}
                    fill="#a3e635"
                    fillOpacity="0.14"
                  />

                  {/* ACWR 1.50 Injury Warning Dashed Line */}
                  <line
                    x1={spPadL}
                    x2={spW - spPadR}
                    y1={yForAcwr(1.5)}
                    y2={yForAcwr(1.5)}
                    stroke="var(--vg-signal)"
                    strokeOpacity="0.55"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={spW - spPadR + 6}
                    y={yForAcwr(1.5) + 3}
                    fill="var(--vg-signal)"
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    1.50
                  </text>
                  <text
                    x={spW - spPadR + 6}
                    y={yForAcwr(1.3) + 3}
                    fill="var(--vg-accent)"
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    1.30
                  </text>
                  <text
                    x={spW - spPadR + 6}
                    y={yForAcwr(0.8) + 3}
                    fill="var(--vg-accent)"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    0.80
                  </text>

                  {/* Left Axis HRV Ticks */}
                  {[minHrvAxis, Math.round((minHrvAxis + maxHrvAxis) / 2), maxHrvAxis].map(
                    (tick) => (
                      <text
                        key={tick}
                        x={spPadL - 7}
                        y={yForHrv(tick) + 3}
                        textAnchor="end"
                        fill="var(--vg-cryo)"
                        fillOpacity="0.8"
                        fontSize="8.5"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {tick}ms
                      </text>
                    )
                  )}

                  {/* HRV Bars per day */}
                  {result.telemetry7Day.map((d, idx) => {
                    const cx = xForDay(idx);
                    const yTop = yForHrv(d.hrvMs);
                    const barH = Math.max(4, spPadT + spPlotH - yTop);
                    const isSelected = idx === selectedDayIdx;
                    return (
                      <g key={d.dayLabel}>
                        <rect
                          x={cx - 12}
                          y={yTop}
                          width={24}
                          height={barH}
                          rx="4"
                          fill="var(--vg-cryo)"
                          fillOpacity={isSelected ? 0.5 : 0.2}
                          stroke={isSelected ? 'var(--vg-cryo)' : 'none'}
                          strokeWidth="1.2"
                        />
                        <text
                          x={cx}
                          y={spH - 8}
                          textAnchor="middle"
                          fill={isSelected ? 'var(--vg-ink)' : 'currentColor'}
                          fillOpacity={isSelected ? 1 : 0.6}
                          fontSize="9"
                          fontWeight={isSelected ? 700 : 500}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {d.dayLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* HRV Polyline */}
                  <path
                    d={hrvLineD}
                    fill="none"
                    stroke="var(--vg-cryo)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* ACWR Polyline */}
                  <path
                    d={acwrPathD}
                    fill="none"
                    stroke="var(--vg-signal)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Day Nodes + Hit Targets */}
                  {result.telemetry7Day.map((d, idx) => {
                    const cx = xForDay(idx);
                    const cyAcwr = yForAcwr(d.acwr);
                    const isSelected = idx === selectedDayIdx;
                    return (
                      <g key={`hit-${d.dayLabel}`}>
                        <circle
                          cx={cx}
                          cy={cyAcwr}
                          r={isSelected ? 4.8 : 3.2}
                          fill="var(--vg-signal)"
                          stroke="var(--vg-surface)"
                          strokeWidth="1.6"
                        />
                        <rect
                          x={cx - dayStep / 2}
                          y={spPadT}
                          width={dayStep}
                          height={spPlotH + 20}
                          fill="transparent"
                          role="button"
                          tabIndex={0}
                          aria-label={`${d.dayLabel}: HRV ${d.hrvMs} ms, ACWR ${d.acwr}`}
                          onClick={() => setSelectedDayIdx(idx)}
                          onMouseEnter={() => setSelectedDayIdx(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDayIdx(idx);
                            }
                          }}
                          className="cursor-pointer outline-none"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Inspected Telemetry Day Strip */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3.5 py-2 font-mono-num text-[11px]">
                <span className="font-bold text-[var(--vg-ink)]">
                  {inspectedDay.dayLabel}
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <span>
                    HRV:{' '}
                    <strong className="text-[var(--vg-cryo)]">
                      {inspectedDay.hrvMs} ms
                    </strong>
                  </span>
                  <span>
                    ACWR:{' '}
                    <strong className="text-[var(--vg-signal)]">
                      {inspectedDay.acwr.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    READINESS:{' '}
                    <strong className="text-[var(--vg-accent)]">
                      {inspectedDay.readinessEst}%
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PerformanceReadinessLab;
