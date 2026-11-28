import React, { lazy, Suspense, useState } from 'react';
import type { BioProtocolMode, BioTelemetrySnapshot } from '../engines/bioAthlete3dEngine';
import type { ReadinessTier } from '../engines/readinessEngine';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import { ArrowRightIcon, PulseIcon } from './Icons';

const BioAthlete3DStage = lazy(() => import('./BioAthlete3DStage'));

interface HeroSectionProps {
  lang: Lang;
  dark: boolean;
  readinessScore: number;
  readinessTier: ReadinessTier;
  vo2Max: number;
  hrvMs: number;
  targetCalories: number;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang,
  dark,
  readinessScore,
  readinessTier,
  vo2Max,
  hrvMs,
  targetCalories,
}) => {
  const t = COPY[lang].hero;
  const [liveTelemetry, setLiveTelemetry] = useState<BioTelemetrySnapshot | null>(null);
  const [liveProtocol, setLiveProtocol] = useState<BioProtocolMode>('LIVE_TELEMETRY');

  const displayVo2 = liveTelemetry ? liveTelemetry.vo2MlKgMin : vo2Max;
  const displayHrv = liveTelemetry ? liveTelemetry.hrvMs : hrvMs;
  const displayReadiness = liveTelemetry ? liveTelemetry.hrvReadinessPct : readinessScore;
  const displayZone = liveTelemetry ? liveTelemetry.karvonenZone : 'Z3';

  return (
    <section
      id="top"
      className="no-print relative overflow-hidden border-b border-[var(--vg-border)] vg-grid-bg"
    >
      <div
        className="pointer-events-none absolute -top-28 right-0 h-[420px] w-[520px] rounded-full opacity-15 blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, rgba(16,185,129,0.4) 0%, rgba(8,9,12,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
        <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column (5 Cols): Swiss Sports-Science Manifesto + Live Synced KPIs */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-1 font-mono-num text-[10px] font-semibold tracking-[0.14em] text-[var(--vg-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <span>VANGUARD v4.0 · 3D BIO-TELEMETRY ATHLETE TWIN</span>
            </div>

            <h1 className="font-display mt-4 text-3xl font-bold leading-[1.04] tracking-tight text-[var(--vg-ink)] sm:text-4xl xl:text-[2.95rem]">
              {t.titleLine1}
              <br />
              <span className="text-[var(--vg-accent)]">{t.titleLine2}</span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--vg-muted)]">
              {t.subtitle}
            </p>

            {/* Primary & Secondary Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <a
                href="#readiness-lab"
                className="inline-flex items-center gap-2 rounded-lg bg-[#a3e635] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#08090c] shadow-[0_0_24px_rgba(163,230,53,0.22)] transition-all hover:brightness-105 active:scale-[0.98]"
              >
                <span>{t.ctaPrimary}</span>
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#metabolic-lab"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)]"
              >
                <span>{t.ctaSecondary}</span>
              </a>
            </div>

            {/* Live Synced 4-Metric Bio-Performance Telemetry Strip */}
            <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-[var(--vg-border)] pt-5">
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2.5">
                <div className="font-mono-num text-[9.5px] uppercase tracking-[0.12em] text-[var(--vg-muted)]">
                  {lang === 'en' ? 'VO2MAX / ZONE' : 'VO2MAX / VÙNG TIM'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-bold text-[var(--vg-ink)]">
                  {displayVo2.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    · {displayZone}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2.5">
                <div className="font-mono-num text-[9.5px] uppercase tracking-[0.12em] text-[var(--vg-muted)]">
                  {lang === 'en' ? 'AUTONOMIC HRV' : 'SẴN SÀNG HRV'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-bold text-[var(--vg-ink)]">
                  {displayReadiness}%{' '}
                  <span className="text-xs font-normal text-[var(--vg-muted)]">({displayHrv}ms)</span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2.5">
                <div className="font-mono-num text-[9.5px] uppercase tracking-[0.12em] text-[var(--vg-muted)]">
                  {lang === 'en' ? 'BLOOD LACTATE' : 'LACTATE MÁU'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-bold text-[var(--vg-ink)]">
                  {liveTelemetry ? `${liveTelemetry.bloodLactateMmol.toFixed(2)} mmol/L` : '2.85 mmol/L'}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2.5">
                <div className="font-mono-num text-[9.5px] uppercase tracking-[0.12em] text-[var(--vg-muted)]">
                  {lang === 'en' ? 'DAILY TARGET' : 'MỤC TIÊU KCAL'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-bold text-[var(--vg-ink)]">
                  {targetCalories.toLocaleString('en-US')}{' '}
                  <span className="text-[10px] text-[var(--vg-muted)]">kcal</span>
                </div>
              </div>
            </div>

            <div className="mt-3 inline-flex items-center gap-2 font-mono-num text-[10px] tracking-[0.1em] uppercase text-[var(--vg-muted)]">
              <PulseIcon className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {readinessTier} · {liveProtocol.replace('_', ' ')} · {t.kpi1Val} · {t.kpi2Val}
              </span>
            </div>
          </div>

          {/* Right Column (7 Cols): 60fps Interactive Three.js 3D Kinematic Bio-Athlete Twin */}
          <div className="lg:col-span-7">
            <Suspense
              fallback={
                <div className="min-h-[480px] rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] flex flex-col items-center justify-center gap-2 font-mono-num text-xs text-[var(--vg-muted)]">
                  <PulseIcon className="h-6 w-6 animate-pulse text-emerald-500" />
                  <span>
                    {lang === 'en'
                      ? 'Initializing 60fps 3D Bio-Telemetry Athlete Twin...'
                      : 'Đang nạp Vận Động Viên 3D Động Học 60fps...'}
                  </span>
                </div>
              }
            >
              <BioAthlete3DStage
                lang={lang}
                dark={dark}
                onTelemetryChange={(snap, mode) => {
                  setLiveTelemetry(snap);
                  setLiveProtocol(mode);
                }}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
};
