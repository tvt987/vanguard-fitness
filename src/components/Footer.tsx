import React from 'react';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import { VanguardMark } from './Icons';

interface FooterProps {
  lang: Lang;
}

export const Footer: React.FC<FooterProps> = ({ lang }) => {
  const t = COPY[lang].footer;
  const nav = COPY[lang].nav;

  return (
    <footer className="no-print bg-[var(--vg-surface)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-12">
          {/* Brand Column */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <VanguardMark className="h-8 w-8 text-[var(--vg-ink)]" />
              <div className="leading-none">
                <span className="font-display block text-base font-bold tracking-[0.14em] text-[var(--vg-ink)]">
                  VANGUARD
                </span>
                <span className="font-mono-num text-[9px] tracking-[0.22em] text-[var(--vg-muted)]">
                  BIO-PERFORMANCE CLUB
                </span>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-[var(--vg-muted)]">
              {t.tagline}
            </p>
          </div>

          {/* Locations */}
          <div className="md:col-span-3">
            <h3 className="font-mono-num text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--vg-accent)]">
              {t.locationsTitle}
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[var(--vg-muted)]">
              <li>{t.d1}</li>
              <li>{t.td}</li>
            </ul>
          </div>

          {/* Hours */}
          <div className="md:col-span-3">
            <h3 className="font-mono-num text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--vg-accent)]">
              {t.hoursTitle}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-[var(--vg-muted)]">
              {t.hoursVal}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-[var(--vg-ink)]">
              <a href="#readiness-lab" className="hover:text-[var(--vg-accent)]">
                {nav.readiness}
              </a>
              <a href="#metabolic-lab" className="hover:text-[var(--vg-accent)]">
                {nav.metabolic}
              </a>
              <a href="#periodization-lab" className="hover:text-[var(--vg-accent)]">
                {nav.periodization}
              </a>
              <a href="#timetable" className="hover:text-[var(--vg-accent)]">
                {nav.timetable}
              </a>
              <a href="#membership" className="hover:text-[var(--vg-accent)]">
                {nav.membership}
              </a>
            </div>
          </div>

          {/* Concierge & Architecture */}
          <div className="md:col-span-2">
            <h3 className="font-mono-num text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--vg-accent)]">
              {t.contactTitle}
            </h3>
            <ul className="mt-3 space-y-2 font-mono-num text-xs text-[var(--vg-muted)]">
              <li>
                <a
                  href="mailto:tinhkun102@gmail.com"
                  className="hover:text-[var(--vg-accent)]"
                >
                  tinhkun102@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/tvt987"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--vg-accent)]"
                >
                  github.com/tvt987
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-[var(--vg-border)] pt-6 font-mono-num text-[11px] text-[var(--vg-muted)] sm:flex-row sm:items-center">
          <span>© 2026 VANGUARD BIO-PERFORMANCE CLUB · V3.0</span>
          <span>{t.builtBy}</span>
        </div>
      </div>
    </footer>
  );
};
