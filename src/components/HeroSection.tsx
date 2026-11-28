import React from 'react';
import type { ReadinessTier } from '../engines/readinessEngine';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import { ArrowRightIcon, PulseIcon } from './Icons';

interface HeroSectionProps {
  lang: Lang;
  readinessScore: number;
  readinessTier: ReadinessTier;
  vo2Max: number;
  hrvMs: number;
  targetCalories: number;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang,
  readinessScore,
  readinessTier,
  vo2Max,
  hrvMs,
  targetCalories,
}) => {
  const t = COPY[lang].hero;
  const ringStroke =
    readinessTier === 'GREEN'
      ? '#a3e635'
      : readinessTier === 'AMBER'
        ? '#f59e0b'
        : '#f43f5e';
  const tierTextColor =
    readinessTier === 'GREEN'
      ? 'text-[#a3e635]'
      : readinessTier === 'AMBER'
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <section
      id="top"
      className="no-print relative overflow-hidden border-b border-[var(--vg-border)] vg-grid-bg"
    >
      {/* Subtle architectural radial glow */}
      <div
        className="pointer-events-none absolute -top-28 right-0 h-[420px] w-[520px] rounded-full opacity-20 blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, rgba(163,230,53,0.45) 0%, rgba(8,9,12,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-11 lg:px-8 lg:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Editorial Manifesto + CTAs + KPI Telemetry */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-1 font-mono-num text-[10px] font-semibold tracking-[0.16em] text-[var(--vg-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a3e635] shadow-[0_0_8px_#a3e635]" />
              <span>{t.eyebrow}</span>
            </div>

            <h1 className="font-display mt-5 text-4xl font-bold leading-[1.03] tracking-tight text-[var(--vg-ink)] sm:text-5xl xl:text-[3.5rem]">
              {t.titleLine1}
              <br />
              <span className="text-[var(--vg-accent)]">{t.titleLine2}</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--vg-muted)] sm:text-base">
              {t.subtitle}
            </p>

            {/* Primary & Secondary Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#readiness-lab"
                className="inline-flex items-center gap-2 rounded-lg bg-[#a3e635] px-5 py-3 text-sm font-bold text-[#08090c] shadow-[0_0_24px_rgba(163,230,53,0.25)] transition-all hover:brightness-105 active:scale-[0.98]"
              >
                <span>{t.ctaPrimary}</span>
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#metabolic-lab"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-5 py-3 text-sm font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)]"
              >
                <span>{t.ctaSecondary}</span>
              </a>
            </div>

            {/* 3 Bio-Athletic Telemetry KPIs */}
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-[var(--vg-border)] pt-6">
              <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)]/80 px-3 py-2.5">
                <div className="font-mono-num text-[10px] tracking-[0.14em] text-[var(--vg-muted)]">
                  {t.kpi1Label}
                </div>
                <div className="font-mono-num mt-1 text-lg font-bold text-[var(--vg-cryo)] sm:text-xl">
                  {t.kpi1Val}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)]/80 px-3 py-2.5">
                <div className="font-mono-num text-[10px] tracking-[0.14em] text-[var(--vg-muted)]">
                  {t.kpi2Label}
                </div>
                <div className="font-mono-num mt-1 text-lg font-bold text-[var(--vg-accent)] sm:text-xl">
                  {t.kpi2Val}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)]/80 px-3 py-2.5">
                <div className="font-mono-num text-[10px] tracking-[0.14em] text-[var(--vg-muted)]">
                  {t.kpi3Label}
                </div>
                <div className="font-mono-num mt-1 text-lg font-bold text-[var(--vg-ink)] sm:text-xl">
                  {t.kpi3Val}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Architectural Visual + Live Whoop-Style Telemetry HUD */}
          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--vg-border)] bg-[#08090c] shadow-2xl">
              <img
                src="./images/hero-club.webp"
                alt="Vanguard Bio-Performance Club Iron Vault training sanctuary"
                width={1280}
                height={720}
                className="aspect-[16/10] w-full object-cover opacity-90"
              />
              {/* Top gradient scrim & status chip */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090c] via-[#08090c]/20 to-transparent" />

              <div className="absolute top-3.5 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#08090c]/80 px-3 py-1 font-mono-num text-[10px] font-semibold tracking-[0.14em] text-[#e2e8f0] backdrop-blur-md">
                  <PulseIcon className="h-3.5 w-3.5 text-[#a3e635]" />
                  <span>{t.hudStatus}</span>
                </div>
                <div className="rounded-full border border-[#a3e635]/40 bg-[#08090c]/80 px-3 py-1 font-mono-num text-[10px] font-bold tracking-[0.12em] text-[#a3e635] backdrop-blur-md">
                  {t.hudOccupancy}
                </div>
              </div>

              {/* Bottom Whoop-Precision Telemetry Overlay */}
              <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/12 bg-[#08090c]/85 p-3 sm:bottom-3.5 sm:left-3.5 sm:right-3.5 sm:p-3.5 backdrop-blur-md">
                <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-3">
                  {/* Radial VO2 Gauge */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                        <circle
                          cx="22"
                          cy="22"
                          r="17"
                          fill="none"
                          stroke="rgba(226,232,240,0.14)"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="17"
                          fill="none"
                          stroke={ringStroke}
                          strokeWidth="3.5"
                          strokeDasharray="106.8"
                          strokeDashoffset={106.8 * (1 - readinessScore / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="font-mono-num absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#e2e8f0]">
                        {readinessScore}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono-num whitespace-nowrap text-[9px] tracking-[0.1em] text-[#94a3b8]">
                        {t.hudReadiness}
                      </div>
                      <div className={`font-mono-num whitespace-nowrap text-xs font-bold ${tierTextColor}`}>
                        {readinessTier} · {readinessScore}%
                      </div>
                    </div>
                  </div>

                  {/* Live ECG / HRV Mini Waveform (hidden on narrow mobile to prevent HUD crowding) */}
                  <div className="hidden flex-col items-center sm:flex">
                    <svg
                      viewBox="0 0 120 30"
                      className="h-7 w-full max-w-[110px]"
                      aria-hidden="true"
                    >
                      <polyline
                        fill="none"
                        stroke={ringStroke}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points="0,16 18,16 25,16 31,6 37,25 43,12 49,16 70,16 78,16 84,4 90,26 96,11 102,16 120,16"
                      />
                    </svg>
                    <span className="font-mono-num text-[9px] tracking-[0.12em] text-[#94a3b8]">
                      {hrvMs}ms HRV · {vo2Max.toFixed(1)} VO2
                    </span>
                  </div>

                  {/* Synced Daily Target kcal */}
                  <div className="text-right">
                    <div className="font-mono-num text-[9px] tracking-[0.12em] text-[#94a3b8]">
                      {lang === 'en' ? 'ACTIVE KCAL' : 'MỤC TIÊU KCAL'}
                    </div>
                    <div className="font-mono-num text-base font-bold text-[#e2e8f0] sm:text-lg">
                      {targetCalories.toLocaleString('en-US')}
                      <span className="ml-1 text-[10px] font-medium text-[#a3e635]">
                        kcal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
