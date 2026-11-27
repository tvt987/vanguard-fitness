import React, { useState } from 'react';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import type { CurrencyCode } from '../engines/membership';
import {
  CloseIcon,
  MenuIcon,
  MoonIcon,
  QrIcon,
  SunIcon,
  VanguardMark,
} from './Icons';

interface NavbarProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  activeBookingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  setLang,
  currency,
  setCurrency,
  dark,
  setDark,
  activeBookingCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = COPY[lang].nav;

  const navItems = [
    { href: '#metabolic-lab', label: t.metabolic },
    { href: '#timetable', label: t.timetable },
    { href: '#specialists', label: t.trainers },
    { href: '#membership', label: t.membership },
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-[var(--vg-border)] bg-[var(--vg-bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2.5 focus:outline-none"
          aria-label="Vanguard Bio-Performance Club"
        >
          <VanguardMark className="h-8 w-8 text-[var(--vg-ink)]" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-bold tracking-[0.14em] text-[var(--vg-ink)]">
              VANGUARD
            </span>
            <span className="font-mono-num text-[9px] tracking-[0.22em] text-[var(--vg-muted)]">
              BIO-PERFORMANCE
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs font-medium tracking-[0.08em] uppercase text-[var(--vg-muted)] transition-colors hover:text-[var(--vg-ink)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Lang Toggle */}
          <div
            className="flex items-center rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 text-[11px] font-mono-num"
            role="group"
            aria-label="Language selector"
          >
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded px-2 py-1 font-semibold transition-colors cursor-pointer ${
                lang === 'en'
                  ? 'bg-[#a3e635] text-[#08090c]'
                  : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('vi')}
              className={`rounded px-2 py-1 font-semibold transition-colors cursor-pointer ${
                lang === 'vi'
                  ? 'bg-[#a3e635] text-[#08090c]'
                  : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
              }`}
            >
              VI
            </button>
          </div>

          {/* Currency Toggle */}
          <button
            type="button"
            onClick={() => setCurrency(currency === 'VND' ? 'USD' : 'VND')}
            className="hidden sm:inline-flex items-center rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono-num text-[11px] font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)] cursor-pointer"
            aria-label="Toggle currency"
          >
            {currency === 'VND' ? 'VNĐ' : 'USD'}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)] cursor-pointer"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>

          {/* Active Bookings pill (desktop) */}
          <a
            href="#timetable"
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono-num text-[11px] font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)]"
          >
            <span className="h-2 w-2 rounded-full bg-[#a3e635]" />
            <span>{activeBookingCount}</span>
            <span className="text-[var(--vg-muted)]">{t.bookings}</span>
          </a>

          {/* Member Pass jump button */}
          <a
            href="#member-pass"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[#a3e635] px-3 py-1.5 text-xs font-bold tracking-wide text-[#08090c] transition-transform hover:brightness-105 active:scale-[0.98]"
          >
            <QrIcon className="h-3.5 w-3.5" />
            <span>{t.myPass}</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-ink)] lg:hidden cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-[var(--vg-border)] bg-[var(--vg-surface)] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm font-semibold text-[var(--vg-ink)] hover:bg-[var(--vg-surface-alt)]"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--vg-border)] pt-3">
              <button
                type="button"
                onClick={() => setCurrency(currency === 'VND' ? 'USD' : 'VND')}
                className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-bg)] px-3 py-1.5 font-mono-num text-xs font-semibold text-[var(--vg-ink)]"
              >
                {currency === 'VND' ? 'Currency: VNĐ' : 'Currency: USD'}
              </button>
              <a
                href="#member-pass"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-[#08090c]"
              >
                <QrIcon className="h-3.5 w-3.5" />
                <span>{t.myPass}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
