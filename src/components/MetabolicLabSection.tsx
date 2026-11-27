import React, { useState } from 'react';
import type {
  ActivityLevel,
  MetabolicInput,
  MetabolicResult,
  TrainingGoal,
} from '../engines/metabolic';
import { exportMetabolicPlanCsv } from '../engines/metabolic';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import {
  DownloadIcon,
  DropletIcon,
  FlameIcon,
  PrinterIcon,
} from './Icons';

interface MetabolicLabSectionProps {
  lang: Lang;
  input: MetabolicInput;
  onChangeInput: (next: MetabolicInput) => void;
  result: MetabolicResult;
  onPrintBlueprint: () => void;
}

const ACTIVITIES: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'athlete',
  'elite',
];

const GOALS: TrainingGoal[] = [
  'fat_loss',
  'lean_recomp',
  'hypertrophy',
  'endurance',
];

export const MetabolicLabSection: React.FC<MetabolicLabSectionProps> = ({
  lang,
  input,
  onChangeInput,
  result,
  onPrintBlueprint,
}) => {
  const t = COPY[lang].metabolic;
  const [selectedWeek, setSelectedWeek] = useState<number>(12);

  const handleDownloadCsv = () => {
    const csv = exportMetabolicPlanCsv(input, result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vanguard-12w-metabolic-${input.goal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute SVG coordinates for the 12-week transformation dual-line chart
  const chartW = 580;
  const chartH = 220;
  const padL = 44;
  const padR = 18;
  const padT = 20;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allValues = result.trajectory.flatMap((p) => [p.weightKg, p.leanMassKg]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const yMin = Math.floor(rawMin - 3);
  const yMax = Math.ceil(rawMax + 3);
  const ySpan = Math.max(1, yMax - yMin);

  const xForWeek = (week: number) => padL + (week / 12) * plotW;
  const yForKg = (kg: number) => padT + plotH - ((kg - yMin) / ySpan) * plotH;

  const weightPath = result.trajectory
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xForWeek(p.week).toFixed(1)} ${yForKg(p.weightKg).toFixed(1)}`)
    .join(' ');

  const leanPath = result.trajectory
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xForWeek(p.week).toFixed(1)} ${yForKg(p.leanMassKg).toFixed(1)}`)
    .join(' ');

  const leanAreaPath = `${leanPath} L ${xForWeek(12).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xForWeek(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) =>
    Math.round(yMin + frac * ySpan)
  );

  const activePoint =
    result.trajectory[selectedWeek] ?? result.trajectory[result.trajectory.length - 1];

  const formatSigned = (n: number, unit: string) =>
    `${n > 0 ? '+' : ''}${n.toFixed(1)} ${unit}`;

  return (
    <section
      id="metabolic-lab"
      className="no-print border-b border-[var(--vg-border)] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
              {t.eyebrow}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--vg-muted)]">
              {t.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)] cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>{t.exportCsv}</span>
            </button>
            <button
              type="button"
              onClick={onPrintBlueprint}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)] cursor-pointer"
            >
              <PrinterIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>{t.printPlan}</span>
            </button>
          </div>
        </div>

        {/* Main 12-col Calculator Grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* LEFT: Biometric Calibration Controls (5 cols) */}
          <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 sm:p-6 lg:col-span-5">
            {/* Sex Toggle */}
            <div>
              <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                {t.sex}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['male', 'female'] as const).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    onClick={() => onChangeInput({ ...input, sex })}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                      input.sex === sex
                        ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c]'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-accent)]'
                    }`}
                  >
                    {sex === 'male' ? t.male : t.female}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders: Age, Weight, Height, Body Fat */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-age" className="font-medium text-[var(--vg-muted)]">
                    {t.age}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.age} yr
                  </span>
                </div>
                <input
                  id="slider-age"
                  type="range"
                  min={18}
                  max={72}
                  value={input.age}
                  onChange={(e) =>
                    onChangeInput({ ...input, age: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-weight" className="font-medium text-[var(--vg-muted)]">
                    {t.weight}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.weightKg} kg
                  </span>
                </div>
                <input
                  id="slider-weight"
                  type="range"
                  min={42}
                  max={135}
                  value={input.weightKg}
                  onChange={(e) =>
                    onChangeInput({ ...input, weightKg: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-height" className="font-medium text-[var(--vg-muted)]">
                    {t.height}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.heightCm} cm
                  </span>
                </div>
                <input
                  id="slider-height"
                  type="range"
                  min={148}
                  max={205}
                  value={input.heightCm}
                  onChange={(e) =>
                    onChangeInput({ ...input, heightCm: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-bf" className="font-medium text-[var(--vg-muted)]">
                    {t.bodyFat}
                  </label>
                  <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                    {input.bodyFatPct}%
                  </span>
                </div>
                <input
                  id="slider-bf"
                  type="range"
                  min={8}
                  max={38}
                  value={input.bodyFatPct}
                  onChange={(e) =>
                    onChangeInput({ ...input, bodyFatPct: Number(e.target.value) })
                  }
                  className="vg-slider mt-2"
                />
              </div>
            </div>

            {/* Activity Level */}
            <div className="mt-6">
              <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                {t.activity}
              </span>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {ACTIVITIES.map((act) => {
                  const active = input.activity === act;
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => onChangeInput({ ...input, activity: act })}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[var(--vg-accent)] bg-[var(--vg-accent)]/12 text-[var(--vg-ink)]'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/60 text-[var(--vg-muted)] hover:border-[var(--vg-accent)]/60'
                      }`}
                    >
                      <span className="text-xs font-bold text-[var(--vg-ink)]">
                        {t.activities[act].label}
                      </span>
                      <span className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                        {t.activities[act].sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Training Goal */}
            <div className="mt-6">
              <span className="font-mono-num text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                {t.goal}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {GOALS.map((goal) => {
                  const active = input.goal === goal;
                  return (
                    <button
                      key={goal}
                      type="button"
                      data-testid={`goal-btn-${goal}`}
                      onClick={() => onChangeInput({ ...input, goal })}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c]'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-accent)]'
                      }`}
                    >
                      <span className="font-display text-sm font-bold">
                        {t.goals[goal].label}
                      </span>
                      <span
                        className={`font-mono-num mt-0.5 text-[10px] ${
                          active ? 'text-[#08090c]/80 font-semibold' : 'text-[var(--vg-muted)]'
                        }`}
                      >
                        {t.goals[goal].sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Telemetry Readout + Macro Engine + 12-Week SVG Curve (7 cols) */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            {/* Top Energy & Hydration Card */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 font-mono-num text-[11px] font-semibold tracking-[0.16em] text-[var(--vg-muted)]">
                    <FlameIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                    <span>{t.dailyTarget}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="metabolic-target-kcal"
                      className="font-mono-num text-4xl font-bold text-[var(--vg-accent)] sm:text-5xl"
                    >
                      {result.targetCalories.toLocaleString('en-US')}
                    </span>
                    <span className="font-mono-num text-sm font-semibold text-[var(--vg-muted)]">
                      kcal / day
                    </span>
                  </div>
                </div>

                {/* BMR / TDEE / Delta + Hydration */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2">
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {t.bmr}
                    </div>
                    <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-ink)]">
                      {result.bmr}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2">
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {t.tdee}
                    </div>
                    <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-ink)]">
                      {result.tdee}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2">
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {t.delta}
                    </div>
                    <div
                      className={`font-mono-num mt-0.5 text-sm font-bold ${
                        result.dailyDeltaKcal < 0
                          ? 'text-[var(--vg-strain)]'
                          : 'text-[var(--vg-accent)]'
                      }`}
                    >
                      {result.dailyDeltaKcal > 0 ? '+' : ''}
                      {result.dailyDeltaKcal}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2">
                    <div className="flex items-center gap-1 font-mono-num text-[10px] text-[var(--vg-muted)]">
                      <DropletIcon className="h-3 w-3 text-[var(--vg-cryo)]" />
                      <span>H2O</span>
                    </div>
                    <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-cryo)]">
                      {result.hydrationLiters} L
                    </div>
                  </div>
                </div>
              </div>

              {/* Proportional Macro Bar */}
              <div className="mt-5">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--vg-surface-alt)]">
                  <div
                    style={{ width: `${result.macros.proteinPct}%` }}
                    className="bg-[#a3e635] transition-all duration-300"
                    title="Protein"
                  />
                  <div
                    style={{ width: `${result.macros.carbsPct}%` }}
                    className="bg-[#38bdf8] transition-all duration-300"
                    title="Carbs"
                  />
                  <div
                    style={{ width: `${result.macros.fatPct}%` }}
                    className="bg-[#f97316] transition-all duration-300"
                    title="Fat"
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--vg-ink)]">
                        {t.protein}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--vg-accent)]">
                        {result.macros.proteinPct}%
                      </span>
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-bold text-[var(--vg-ink)]">
                      {result.macros.proteinG}
                      <span className="ml-0.5 text-xs font-normal text-[var(--vg-muted)]">g</span>
                    </div>
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {result.macros.proteinKcal} kcal
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--vg-ink)]">
                        {t.carbs}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--vg-cryo)]">
                        {result.macros.carbsPct}%
                      </span>
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-bold text-[var(--vg-ink)]">
                      {result.macros.carbsG}
                      <span className="ml-0.5 text-xs font-normal text-[var(--vg-muted)]">g</span>
                    </div>
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {result.macros.carbsKcal} kcal
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--vg-ink)]">
                        {t.fat}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--vg-strain)]">
                        {result.macros.fatPct}%
                      </span>
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-bold text-[var(--vg-ink)]">
                      {result.macros.fatG}
                      <span className="ml-0.5 text-xs font-normal text-[var(--vg-muted)]">g</span>
                    </div>
                    <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                      {result.macros.fatKcal} kcal
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 12-Week Transformation SVG Curve Card */}
            <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--vg-ink)] sm:text-lg">
                    {t.curveTitle}
                  </h3>
                  <p className="text-xs text-[var(--vg-muted)]">{t.curveSub}</p>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono-num">
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-ink)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--vg-ink)]" />
                    {t.legendWeight}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--vg-accent)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#a3e635]" />
                    {t.legendLean}
                  </span>
                </div>
              </div>

              {/* Interactive SVG Graph */}
              <div className="mt-4 w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="h-auto w-full select-none"
                  role="img"
                  aria-label="12-Week Projected Weight and Lean Mass Curve"
                >
                  <defs>
                    <linearGradient id="leanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a3e635" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#a3e635" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines & Y Labels */}
                  {yTicks.map((tick, idx) => {
                    const y = yForKg(tick);
                    return (
                      <g key={idx}>
                        <line
                          x1={padL}
                          x2={chartW - padR}
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          strokeOpacity="0.11"
                          strokeDasharray="3 4"
                        />
                        <text
                          x={padL - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="currentColor"
                          fillOpacity="0.55"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {/* Active week vertical guide */}
                  <line
                    x1={xForWeek(activePoint.week)}
                    x2={xForWeek(activePoint.week)}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="#a3e635"
                    strokeOpacity="0.45"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />

                  {/* Lean Mass Area & Line */}
                  <path d={leanAreaPath} fill="url(#leanAreaGrad)" />
                  <path
                    d={leanPath}
                    fill="none"
                    stroke="#a3e635"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Total Weight Line */}
                  <path
                    d={weightPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Interactive Week Nodes & X Labels */}
                  {result.trajectory.map((pt) => {
                    const cx = xForWeek(pt.week);
                    const cyW = yForKg(pt.weightKg);
                    const cyL = yForKg(pt.leanMassKg);
                    const isSelected = pt.week === activePoint.week;
                    return (
                      <g
                        key={pt.week}
                        onMouseEnter={() => setSelectedWeek(pt.week)}
                        onClick={() => setSelectedWeek(pt.week)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={cx - 16}
                          y={padT}
                          width={32}
                          height={plotH + 22}
                          fill="transparent"
                        />
                        <circle
                          cx={cx}
                          cy={cyW}
                          r={isSelected ? 5 : 2.8}
                          fill="var(--vg-ink)"
                          stroke="var(--vg-surface)"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={cx}
                          cy={cyL}
                          r={isSelected ? 5 : 2.8}
                          fill="#a3e635"
                          stroke="#08090c"
                          strokeWidth="1.5"
                        />
                        {(pt.week % 2 === 0 || pt.week === 12) && (
                          <text
                            x={cx}
                            y={chartH - 8}
                            textAnchor="middle"
                            fill="currentColor"
                            fillOpacity={isSelected ? 1 : 0.55}
                            fontSize="10"
                            fontWeight={isSelected ? 700 : 500}
                            fontFamily="JetBrains Mono, monospace"
                          >
                            W{pt.week}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active Week Telemetry Readout Strip */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3.5 py-2.5 font-mono-num text-xs">
                <span className="font-bold text-[var(--vg-accent)]">
                  {t.weekLabel.toUpperCase()} {activePoint.week}
                </span>
                <span className="text-[var(--vg-ink)]">
                  WT: <strong>{activePoint.weightKg.toFixed(1)} kg</strong>
                </span>
                <span className="text-[var(--vg-accent)]">
                  LEAN: <strong>{activePoint.leanMassKg.toFixed(1)} kg</strong>
                </span>
                <span className="text-[var(--vg-muted)]">
                  BF: <strong className="text-[var(--vg-ink)]">{activePoint.bodyFatPct.toFixed(1)}%</strong>
                </span>
                <span className="text-[var(--vg-muted)]">
                  TDEE: <strong className="text-[var(--vg-ink)]">{activePoint.projectedTdee}</strong>
                </span>
              </div>

              {/* 12-Week Delta Badges & Weekly Training Protocol */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-bg)]/60 p-2.5">
                  <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    {t.deltaWeight}
                  </div>
                  <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-ink)]">
                    {formatSigned(result.summary12Week.weightDeltaKg, 'kg')}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-bg)]/60 p-2.5">
                  <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    {t.deltaLean}
                  </div>
                  <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-accent)]">
                    {formatSigned(result.summary12Week.leanMassDeltaKg, 'kg')}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-bg)]/60 p-2.5">
                  <div className="font-mono-num text-[10px] text-[var(--vg-muted)]">
                    {t.deltaBf}
                  </div>
                  <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--vg-cryo)]">
                    {formatSigned(result.summary12Week.bodyFatDeltaPct, '%')}
                  </div>
                </div>
              </div>

              {/* Prescribed Split Bar */}
              <div className="mt-4 border-t border-[var(--vg-border)] pt-3.5">
                <div className="font-mono-num text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--vg-muted)]">
                  {t.protocolTitle} · {t.electrolytes}: {result.electrolyteSodiumMg} mg
                </div>
                <div className="mt-2 flex flex-wrap gap-2 font-mono-num text-[11px]">
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 text-[var(--vg-ink)]">
                    {result.weeklyProtocol.strengthSessions}x {t.strength}
                  </span>
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 text-[var(--vg-ink)]">
                    {result.weeklyProtocol.hiitSessions}x {t.hiit}
                  </span>
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 text-[var(--vg-ink)]">
                    {result.weeklyProtocol.pilatesMobility}x {t.pilates}
                  </span>
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 text-[var(--vg-cryo)]">
                    {result.weeklyProtocol.cryoRecovery}x {t.cryo}
                  </span>
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 text-[var(--vg-muted)]">
                    {result.weeklyProtocol.dailySteps.toLocaleString('en-US')} {t.steps}
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
