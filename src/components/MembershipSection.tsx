import React, { useEffect, useState } from 'react';
import type {
  AddOnId,
  BillingCycle,
  CurrencyCode,
  MembershipQuote,
  MembershipTierId,
  VietQrPayload,
} from '../engines/membership';
import {
  formatCurrency,
  MEMBERSHIP_ADDONS,
  MEMBERSHIP_TIERS,
} from '../engines/membership';
import type { MetabolicResult } from '../engines/metabolic';
import type { TrainerProfile } from '../engines/timetable';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import {
  CheckIcon,
  CopyIcon,
  PrinterIcon,
  QrIcon,
  ShieldIcon,
  VanguardMark,
} from './Icons';
import { VectorQr } from './VectorQr';

export type ClubLocationId = 'd1' | 'td';

interface MembershipSectionProps {
  lang: Lang;
  currency: CurrencyCode;
  tierId: MembershipTierId;
  onSelectTier: (tier: MembershipTierId) => void;
  billingCycle: BillingCycle;
  onChangeBillingCycle: (cycle: BillingCycle) => void;
  selectedAddOns: AddOnId[];
  onToggleAddOn: (addon: AddOnId) => void;
  quote: MembershipQuote;
  vietQr: VietQrPayload;
  memberName: string;
  onChangeMemberName: (name: string) => void;
  memberEmail: string;
  onChangeMemberEmail: (email: string) => void;
  homeClub: ClubLocationId;
  onChangeHomeClub: (club: ClubLocationId) => void;
  passActivated: boolean;
  onActivatePass: () => void;
  assignedCoach: TrainerProfile;
  metabolicResult: MetabolicResult;
  activeBookingCount: number;
  onPrintBlueprint: () => void;
}

export const MembershipSection: React.FC<MembershipSectionProps> = ({
  lang,
  currency,
  tierId,
  onSelectTier,
  billingCycle,
  onChangeBillingCycle,
  selectedAddOns,
  onToggleAddOn,
  quote,
  vietQr,
  memberName,
  onChangeMemberName,
  memberEmail,
  onChangeMemberEmail,
  homeClub,
  onChangeHomeClub,
  passActivated,
  onActivatePass,
  assignedCoach,
  metabolicResult,
  activeBookingCount,
  onPrintBlueprint,
}) => {
  const t = COPY[lang].membership;
  const [qrImgError, setQrImgError] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setQrImgError(false);
  }, [vietQr.qrImageUrl]);

  const handleCopy = async (fieldKey: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === fieldKey ? null : prev));
      }, 1800);
    } catch {
      setCopiedField(fieldKey);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === fieldKey ? null : prev));
      }, 1800);
    }
  };

  const isAddOnIncluded = (id: AddOnId): boolean => {
    if (id === 'unlimited_cryo' && (tierId === 'performance' || tierId === 'black')) {
      return true;
    }
    if (id === 'dexa_scan' && tierId === 'black') {
      return true;
    }
    return false;
  };

  const clubLabel = homeClub === 'd1' ? t.clubD1 : t.clubTD;
  const displayName = memberName.trim() || 'VANGUARD ATHLETE';
  const passQrPayload = `VANGUARD|${vietQr.memberId}|${tierId.toUpperCase()}|${homeClub.toUpperCase()}|${vietQr.validThrough}|${passActivated ? 'ACTIVE' : 'PREVIEW'}`;

  return (
    <section
      id="membership"
      className="no-print border-b border-[var(--vg-border)] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header + Monthly/Annual Toggle */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
              {t.eyebrow}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--vg-muted)]">{t.subtitle}</p>
          </div>

          {/* Billing Cycle Segmented Control */}
          <div
            className="inline-flex self-start rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-1 lg:self-auto"
            role="group"
            aria-label="Billing cycle"
          >
            <button
              type="button"
              data-testid="billing-monthly"
              onClick={() => onChangeBillingCycle('monthly')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#a3e635] text-[#08090c]'
                  : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
              }`}
            >
              {t.monthly}
            </button>
            <button
              type="button"
              data-testid="billing-annual"
              onClick={() => onChangeBillingCycle('annual')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-[#a3e635] text-[#08090c]'
                  : 'text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
              }`}
            >
              <span>{t.annual}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold ${
                  billingCycle === 'annual'
                    ? 'bg-[#08090c] text-[#a3e635]'
                    : 'bg-[#a3e635]/15 text-[var(--vg-accent)]'
                }`}
              >
                {t.save20}
              </span>
            </button>
          </div>
        </div>

        {/* 3 Membership Tier Cards */}
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {MEMBERSHIP_TIERS.map((tier) => {
            const isSelected = tier.id === tierId;
            const discountedMonthly =
              billingCycle === 'annual'
                ? Math.round(tier.monthlyPriceVnd * 0.8)
                : tier.monthlyPriceVnd;
            const features = lang === 'en' ? tier.featuresEn : tier.featuresVi;
            const badge = lang === 'en' ? tier.badgeEn : tier.badgeVi;

            return (
              <article
                key={tier.id}
                data-testid={`tier-card-${tier.id}`}
                className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                  isSelected
                    ? 'border-[#a3e635] bg-[var(--vg-surface)] shadow-[0_0_0_1px_rgba(163,230,53,0.35)]'
                    : tier.featured
                      ? 'border-[var(--vg-accent)]/45 bg-[var(--vg-surface)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-[var(--vg-accent)]/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-bold text-[var(--vg-ink)]">
                        {lang === 'en' ? tier.nameEn : tier.nameVi}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--vg-muted)]">
                        {lang === 'en' ? tier.taglineEn : tier.taglineVi}
                      </p>
                    </div>
                    {badge && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 font-mono-num text-[10px] font-bold tracking-[0.1em] ${
                          tier.featured
                            ? 'bg-[#a3e635] text-[#08090c]'
                            : 'border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)]'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mt-5 border-b border-[var(--vg-border)] pb-5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono-num text-3xl font-bold text-[var(--vg-ink)]">
                        {formatCurrency(discountedMonthly, currency)}
                      </span>
                      <span className="font-mono-num text-xs text-[var(--vg-muted)]">
                        {t.perMonth}
                      </span>
                    </div>
                    {billingCycle === 'annual' ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono-num text-[11px]">
                        <span className="line-through text-[var(--vg-muted)]">
                          {formatCurrency(tier.monthlyPriceVnd, currency)}
                        </span>
                        <span className="font-semibold text-[var(--vg-accent)]">
                          {t.billedAnnually}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 font-mono-num text-[11px] text-[var(--vg-muted)]">
                        {t.plusInit}:{' '}
                        <span className="font-semibold text-[var(--vg-ink)]">
                          {formatCurrency(tier.initiationFeeVnd, currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Feature List */}
                  <ul className="mt-5 space-y-2.5">
                    {features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--vg-ink)]"
                      >
                        <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--vg-accent)]" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  data-testid={`tier-btn-${tier.id}`}
                  onClick={() => onSelectTier(tier.id)}
                  className={`mt-6 w-full rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#a3e635] text-[#08090c]'
                      : 'border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[#a3e635] hover:text-[var(--vg-accent)]'
                  }`}
                >
                  {isSelected ? t.selectedTier : t.selectTier}
                </button>
              </article>
            );
          })}
        </div>

        {/* Precision Performance Add-Ons */}
        <div className="mt-8 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 sm:p-6">
          <div className="font-mono-num text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--vg-muted)]">
            {t.addonsTitle}
          </div>
          <div className="mt-3.5 grid gap-3 md:grid-cols-3">
            {MEMBERSHIP_ADDONS.map((addon) => {
              const included = isAddOnIncluded(addon.id);
              const checked = included || selectedAddOns.includes(addon.id);

              return (
                <button
                  key={addon.id}
                  type="button"
                  disabled={included}
                  data-testid={`addon-btn-${addon.id}`}
                  onClick={() => onToggleAddOn(addon.id)}
                  className={`flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all ${
                    included
                      ? 'border-[var(--vg-accent)]/35 bg-[var(--vg-accent)]/8 opacity-90 cursor-default'
                      : checked
                        ? 'border-[#a3e635] bg-[#a3e635]/10 cursor-pointer'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/70 hover:border-[var(--vg-accent)]/60 cursor-pointer'
                  }`}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-display text-sm font-bold text-[var(--vg-ink)]">
                      {lang === 'en' ? addon.nameEn : addon.nameVi}
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c]'
                          : 'border-[var(--vg-border)] bg-[var(--vg-surface)]'
                      }`}
                    >
                      {checked && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--vg-muted)]">
                    {lang === 'en' ? addon.descEn : addon.descVi}
                  </p>
                  <div className="mt-3 font-mono-num text-xs font-bold">
                    {included ? (
                      <span className="text-[var(--vg-accent)]">
                        {t.includedBadge}
                      </span>
                    ) : (
                      <span className="text-[var(--vg-ink)]">
                        +{formatCurrency(addon.monthlyPriceVnd, currency)}{' '}
                        <span className="font-normal text-[var(--vg-muted)]">
                          {t.perMonth}
                        </span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Panel: VietQR Settlement & Digital Member Pass */}
        <div
          id="member-pass"
          className="mt-8 grid gap-6 lg:grid-cols-12"
        >
          {/* Left: Member Profile + Techcombank VietQR Settlement (7 cols) */}
          <div className="rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5 sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-[var(--vg-ink)] sm:text-xl">
                {t.checkoutTitle}
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 font-mono-num text-[10px] font-semibold text-[var(--vg-accent)]">
                <ShieldIcon className="h-3.5 w-3.5" />
                <span>VIETQR · 970407</span>
              </span>
            </div>

            {/* Member Details Form */}
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="member-name-input"
                  className="block font-mono-num text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-muted)]"
                >
                  {t.memberName}
                </label>
                <input
                  id="member-name-input"
                  data-testid="member-name-input"
                  type="text"
                  value={memberName}
                  onChange={(e) => onChangeMemberName(e.target.value)}
                  maxLength={60}
                  className="mt-1.5 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2 text-sm font-medium text-[var(--vg-ink)] outline-none transition-colors focus:border-[var(--vg-accent)]"
                />
              </div>

              <div>
                <label
                  htmlFor="member-email-input"
                  className="block font-mono-num text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-muted)]"
                >
                  {t.memberEmail}
                </label>
                <input
                  id="member-email-input"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => onChangeMemberEmail(e.target.value)}
                  maxLength={80}
                  className="mt-1.5 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2 text-sm font-medium text-[var(--vg-ink)] outline-none transition-colors focus:border-[var(--vg-accent)]"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="member-club-select"
                  className="block font-mono-num text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--vg-muted)]"
                >
                  {t.homeClub}
                </label>
                <select
                  id="member-club-select"
                  value={homeClub}
                  onChange={(e) =>
                    onChangeHomeClub(e.target.value as ClubLocationId)
                  }
                  className="mt-1.5 w-full rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2 text-sm font-medium text-[var(--vg-ink)] outline-none transition-colors focus:border-[var(--vg-accent)]"
                >
                  <option value="d1">{t.clubD1}</option>
                  <option value="td">{t.clubTD}</option>
                </select>
              </div>
            </div>

            {/* Summary Financial Strip */}
            <div className="mt-5 grid gap-3 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] p-4 sm:grid-cols-2">
              <div>
                <div className="font-mono-num text-[10px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                  {t.summaryDue}
                </div>
                <div
                  data-testid="quote-due-today"
                  className="font-mono-num mt-1 text-2xl font-bold text-[var(--vg-accent)]"
                >
                  {formatCurrency(quote.dueTodayVnd, currency)}
                </div>
                {currency === 'USD' && (
                  <div className="font-mono-num text-[11px] text-[var(--vg-muted)]">
                    ≈ {formatCurrency(quote.dueTodayVnd, 'VND')} (VietQR)
                  </div>
                )}
              </div>

              {quote.annualSavingsVnd > 0 ? (
                <div className="sm:text-right">
                  <div className="font-mono-num text-[10px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                    {t.summarySavings}
                  </div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[var(--vg-ink)]">
                    {formatCurrency(quote.annualSavingsVnd, currency)}
                  </div>
                  <div className="font-mono-num text-[10px] font-semibold text-[var(--vg-accent)]">
                    {lang === 'en' ? '-20% + 0 ₫ Initiation' : '-20% + Miễn phí gia nhập'}
                  </div>
                </div>
              ) : (
                <div className="sm:text-right">
                  <div className="font-mono-num text-[10px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                    {t.plusInit}
                  </div>
                  <div className="font-mono-num mt-1 text-lg font-bold text-[var(--vg-ink)]">
                    {formatCurrency(quote.initiationFeeDueVnd, currency)}
                  </div>
                </div>
              )}
            </div>

            {/* Techcombank VietQR Settlement Box */}
            <div className="mt-5 grid items-center gap-4 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-bg)]/60 p-4 sm:grid-cols-12">
              {/* VietQR Image with Offline Vector Fallback */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-white p-3 sm:col-span-5">
                {!qrImgError ? (
                  <img
                    src={vietQr.qrImageUrl}
                    alt={`Techcombank VietQR for ${vietQr.transferContent}`}
                    width={180}
                    height={180}
                    onError={() => setQrImgError(true)}
                    className="h-auto w-full max-w-[172px] rounded-md object-contain"
                  />
                ) : (
                  <VectorQr
                    payload={`VIETQR|${vietQr.bankBin}|${vietQr.accountNumber}|${vietQr.amountVnd}|${vietQr.transferContent}`}
                    sizePx={148}
                    label="Techcombank VietQR Fallback"
                  />
                )}
              </div>

              {/* Bank Metadata & Copy Buttons */}
              <div className="space-y-2.5 sm:col-span-7">
                <div className="font-mono-num text-xs font-bold tracking-[0.1em] uppercase text-[var(--vg-accent)]">
                  {t.vietQrTitle}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2">
                    <span className="text-[var(--vg-muted)]">{t.bankLabel}</span>
                    <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                      {vietQr.bankName} ({vietQr.bankBin})
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2">
                    <div>
                      <span className="block text-[10px] text-[var(--vg-muted)]">
                        {t.accountLabel}
                      </span>
                      <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                        {vietQr.accountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('acc', vietQr.accountNumber)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2 py-1 font-mono-num text-[10px] font-semibold text-[var(--vg-ink)] hover:border-[var(--vg-accent)] cursor-pointer"
                    >
                      <CopyIcon className="h-3 w-3" />
                      <span>{copiedField === 'acc' ? t.copied : t.copy}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2">
                    <span className="text-[var(--vg-muted)]">{t.holderLabel}</span>
                    <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                      {vietQr.accountName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-[var(--vg-muted)]">
                        {t.refLabel}
                      </span>
                      <span className="font-mono-num truncate font-bold text-[var(--vg-accent)]">
                        {vietQr.transferContent}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('ref', vietQr.transferContent)}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2 py-1 font-mono-num text-[10px] font-semibold text-[var(--vg-ink)] hover:border-[var(--vg-accent)] cursor-pointer"
                    >
                      <CopyIcon className="h-3 w-3" />
                      <span>{copiedField === 'ref' ? t.copied : t.copy}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Activate Digital Pass CTA */}
            <button
              type="button"
              data-testid="activate-pass-btn"
              onClick={onActivatePass}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#a3e635] px-5 py-3 text-sm font-bold text-[#08090c] shadow-[0_0_24px_rgba(163,230,53,0.2)] transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer"
            >
              <QrIcon className="h-4 w-4" />
              <span>{t.activateDemo}</span>
            </button>
          </div>

          {/* Right: Obsidian Digital Member Pass Card + Synced Summary + Print Blueprint CTA (5 cols) */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-[#2a3344] bg-[#08090c] p-6 text-[#e2e8f0] shadow-2xl">
              {/* Subtle metallic lime corner glow */}
              <div
                className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full opacity-30 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(163,230,53,0.65) 0%, rgba(8,9,12,0) 70%)',
                }}
              />

              {/* Pass Header */}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <VanguardMark className="h-8 w-8 text-[#e2e8f0]" />
                  <div>
                    <div className="font-display text-sm font-bold tracking-[0.16em]">
                      VANGUARD
                    </div>
                    <div className="font-mono-num text-[9px] tracking-[0.2em] text-[#94a3b8]">
                      {lang === 'en' ? quote.tier.nameEn : quote.tier.nameVi}
                    </div>
                  </div>
                </div>

                <span
                  data-testid="pass-status-badge"
                  className={`rounded-full px-2.5 py-1 font-mono-num text-[10px] font-bold tracking-[0.1em] ${
                    passActivated
                      ? 'bg-[#a3e635] text-[#08090c]'
                      : 'border border-white/20 bg-white/5 text-[#cbd5e1]'
                  }`}
                >
                  {passActivated ? t.passActive : t.passPending}
                </span>
              </div>

              {/* Member Name & ID */}
              <div className="relative mt-6">
                <div className="font-mono-num text-[10px] tracking-[0.16em] text-[#94a3b8]">
                  {t.memberIdLabel}
                </div>
                <div className="font-display mt-1 truncate text-2xl font-bold tracking-tight text-white">
                  {displayName}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 font-mono-num text-xs">
                  <span className="font-bold text-[#a3e635]">
                    {vietQr.memberId}
                  </span>
                  <span className="text-[#64748b]">·</span>
                  <span className="text-[#94a3b8]">
                    {t.validThru}: {vietQr.validThrough}
                  </span>
                </div>
              </div>

              {/* QR Dock & Biometric Snapshot */}
              <div className="relative mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center">
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="font-mono-num text-[9px] tracking-[0.14em] text-[#94a3b8]">
                      {t.assignedCoach}
                    </div>
                    <div className="font-semibold text-white">
                      {assignedCoach.name}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono-num text-[9px] tracking-[0.14em] text-[#94a3b8]">
                      {t.homeClub}
                    </div>
                    <div className="text-[11px] text-[#cbd5e1]">{clubLabel}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono-num text-[10px]">
                    <span className="rounded bg-[#a3e635]/15 px-2 py-0.5 font-bold text-[#a3e635]">
                      {metabolicResult.targetCalories} kcal
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[#e2e8f0]">
                      P {metabolicResult.macros.proteinG}g
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[#e2e8f0]">
                      {activeBookingCount}{' '}
                      {lang === 'en' ? 'locks' : 'lớp đã khóa'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 rounded-lg bg-white p-2 shadow-lg">
                  <VectorQr
                    payload={passQrPayload}
                    sizePx={108}
                    label={`Digital Member Pass QR for ${vietQr.memberId}`}
                  />
                </div>
              </div>

              <div className="relative mt-3 font-mono-num text-[10px] text-[#94a3b8]">
                {t.fallbackQrNote}
              </div>
            </div>

            {/* Synced 12-Week Biometric Telemetry Summary */}
            <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4">
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2.5">
                <div className="font-mono-num text-[9px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                  BMR / TDEE
                </div>
                <div className="font-mono-num mt-1 text-xs font-bold text-[var(--vg-ink)]">
                  {metabolicResult.bmr} / {metabolicResult.tdee}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2.5">
                <div className="font-mono-num text-[9px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                  {lang === 'en' ? '12W LEAN Δ' : 'CƠ NẠC 12T'}
                </div>
                <div className="font-mono-num mt-1 text-xs font-bold text-[var(--vg-accent)]">
                  {metabolicResult.summary12Week.leanMassDeltaKg > 0 ? '+' : ''}
                  {metabolicResult.summary12Week.leanMassDeltaKg.toFixed(1)} kg
                </div>
              </div>
              <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2.5">
                <div className="font-mono-num text-[9px] tracking-[0.12em] uppercase text-[var(--vg-muted)]">
                  {lang === 'en' ? 'HYDRATION' : 'NƯỚC UỐNG'}
                </div>
                <div className="font-mono-num mt-1 text-xs font-bold text-[var(--vg-cryo)]">
                  {metabolicResult.hydrationLiters} L / day
                </div>
              </div>
            </div>

            {/* Print A4 Fitness Blueprint & Digital Pass Card */}
            <div className="flex flex-1 flex-col justify-between rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-accent)]">
                  <PrinterIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-[var(--vg-ink)]">
                    {lang === 'en'
                      ? 'A4 Bio-Performance Blueprint + QR Pass'
                      : 'Phác Đồ Chuyển Hóa A4 + Thẻ QR Hội Viên'}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--vg-muted)]">
                    {lang === 'en'
                      ? 'Generates a clean print-ready A4 sheet combining your Mifflin-St Jeor macros, 12-week curve table, locked timetable sessions, Techcombank VietQR details, and club access pass.'
                      : 'Xuất bản in A4 chuẩn xác bao gồm chỉ số Mifflin-St Jeor, lộ trình 12 tuần, lịch lớp đã khóa, thông tin VietQR Techcombank và thẻ QR ra vào CLB.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="print-a4-btn"
                onClick={onPrintBlueprint}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-4 py-2.5 text-xs font-bold text-[var(--vg-ink)] transition-colors hover:border-[#a3e635] hover:text-[var(--vg-accent)] cursor-pointer"
              >
                <PrinterIcon className="h-4 w-4" />
                <span>{t.printPassBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
