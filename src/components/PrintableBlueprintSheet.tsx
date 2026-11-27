import React from 'react';
import type {
  CurrencyCode,
  MembershipQuote,
  VietQrPayload,
} from '../engines/membership';
import { formatCurrency } from '../engines/membership';
import type { MetabolicInput, MetabolicResult } from '../engines/metabolic';
import type {
  TimetableBookingState,
  TrainerProfile,
} from '../engines/timetable';
import { WEEKLY_CLASSES } from '../engines/timetable';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import type { ClubLocationId } from './MembershipSection';
import { VectorQr } from './VectorQr';

interface PrintableBlueprintSheetProps {
  lang: Lang;
  currency: CurrencyCode;
  memberName: string;
  memberEmail: string;
  homeClub: ClubLocationId;
  passActivated: boolean;
  quote: MembershipQuote;
  vietQr: VietQrPayload;
  assignedCoach: TrainerProfile;
  metabolicInput: MetabolicInput;
  metabolicResult: MetabolicResult;
  bookingState: TimetableBookingState;
}

export const PrintableBlueprintSheet: React.FC<PrintableBlueprintSheetProps> = ({
  lang,
  currency,
  memberName,
  memberEmail,
  homeClub,
  passActivated,
  quote,
  vietQr,
  assignedCoach,
  metabolicInput,
  metabolicResult,
  bookingState,
}) => {
  const tM = COPY[lang].metabolic;
  const tMem = COPY[lang].membership;
  const tTime = COPY[lang].timetable;

  const clubLabel = homeClub === 'd1' ? tMem.clubD1 : tMem.clubTD;
  const lockedSessions = Object.values(bookingState.bookings)
    .map((rec) => {
      const session = WEEKLY_CLASSES.find((c) => c.id === rec.classId);
      return session ? { rec, session } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const sampledTrajectory = metabolicResult.trajectory.filter(
    (pt) => pt.week % 2 === 0
  );

  return (
    <div className="print-only-sheet bg-white text-[#08090c]">
      {/* Header Bar */}
      <div className="flex items-start justify-between border-b-2 border-[#08090c] pb-4">
        <div>
          <div className="font-display text-2xl font-bold tracking-[0.14em]">
            VANGUARD BIO-PERFORMANCE CLUB
          </div>
          <div className="font-mono-num mt-1 text-xs text-[#475569]">
            A4 METABOLIC BLUEPRINT &amp; DIGITAL ACCESS PASS · SAIGON
          </div>
        </div>
        <div className="text-right font-mono-num text-xs">
          <div className="font-bold">{vietQr.memberId}</div>
          <div>
            {tMem.validThru}: {vietQr.validThrough}
          </div>
          <div>{passActivated ? 'STATUS: ACTIVE' : 'STATUS: READY'}</div>
        </div>
      </div>

      {/* Member Pass + VietQR Row */}
      <div className="mt-5 grid grid-cols-12 gap-4 rounded-xl border border-[#cbd5e1] p-4">
        <div className="col-span-8 space-y-1.5 text-xs">
          <div className="font-mono-num text-[10px] font-bold tracking-widest uppercase text-[#475569]">
            MEMBER CREDENTIALS &amp; SETTLEMENT
          </div>
          <div className="text-lg font-bold">
            {memberName.trim() || 'VANGUARD ATHLETE'}
          </div>
          <div className="text-[#334155]">
            Email: {memberEmail || 'concierge@vanguard.club'} · {clubLabel}
          </div>
          <div className="text-[#334155]">
            Tier: <strong>{lang === 'en' ? quote.tier.nameEn : quote.tier.nameVi}</strong> (
            {quote.billingCycle.toUpperCase()}) · Due Today:{' '}
            <strong>{formatCurrency(quote.dueTodayVnd, currency)}</strong>
          </div>
          <div className="text-[#334155]">
            Matched Specialist: <strong>{assignedCoach.name}</strong> (
            {lang === 'en' ? assignedCoach.titleEn : assignedCoach.titleVi})
          </div>
          <div className="font-mono-num pt-1 text-[11px] text-[#0f172a]">
            VietQR: {vietQr.bankName} ({vietQr.bankBin}) · {vietQr.accountNumber} ·{' '}
            {vietQr.accountName} · Ref: {vietQr.transferContent}
          </div>
        </div>

        <div className="col-span-4 flex flex-col items-center justify-center border-l border-[#e2e8f0] pl-4">
          <VectorQr
            payload={`VANGUARD|${vietQr.memberId}|${quote.tier.id.toUpperCase()}|${vietQr.validThrough}`}
            sizePx={104}
            label="A4 Member Pass QR"
          />
          <span className="font-mono-num mt-1 text-[9px] text-[#475569]">
            SCAN AT CLUB TURNSTILE
          </span>
        </div>
      </div>

      {/* Metabolic Calibration Summary */}
      <div className="mt-5">
        <div className="font-mono-num text-[11px] font-bold tracking-widest uppercase text-[#475569]">
          01 · MIFFLIN-ST JEOR METABOLIC TARGETS ({tM.goals[metabolicInput.goal].label.toUpperCase()})
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center font-mono-num">
          <div className="rounded border border-[#cbd5e1] p-2">
            <div className="text-[9px] text-[#475569]">TARGET KCAL</div>
            <div className="text-base font-bold">{metabolicResult.targetCalories}</div>
          </div>
          <div className="rounded border border-[#cbd5e1] p-2">
            <div className="text-[9px] text-[#475569]">BMR / TDEE</div>
            <div className="text-sm font-bold">
              {metabolicResult.bmr} / {metabolicResult.tdee}
            </div>
          </div>
          <div className="rounded border border-[#cbd5e1] p-2">
            <div className="text-[9px] text-[#475569]">PROTEIN</div>
            <div className="text-base font-bold">{metabolicResult.macros.proteinG}g</div>
          </div>
          <div className="rounded border border-[#cbd5e1] p-2">
            <div className="text-[9px] text-[#475569]">CARBS / FAT</div>
            <div className="text-sm font-bold">
              {metabolicResult.macros.carbsG}g / {metabolicResult.macros.fatG}g
            </div>
          </div>
          <div className="rounded border border-[#cbd5e1] p-2">
            <div className="text-[9px] text-[#475569]">HYDRATION</div>
            <div className="text-base font-bold">{metabolicResult.hydrationLiters} L</div>
          </div>
        </div>
      </div>

      {/* 12-Week Projection Table */}
      <div className="mt-5">
        <div className="font-mono-num text-[11px] font-bold tracking-widest uppercase text-[#475569]">
          02 · 12-WEEK BIOMETRIC PROJECTION TABLE
        </div>
        <table className="mt-2 w-full border-collapse font-mono-num text-xs">
          <thead>
            <tr className="border-b border-[#08090c] text-left text-[10px]">
              <th className="py-1.5">WEEK</th>
              <th className="py-1.5">WEIGHT (KG)</th>
              <th className="py-1.5">LEAN MASS (KG)</th>
              <th className="py-1.5">FAT MASS (KG)</th>
              <th className="py-1.5">BODY FAT (%)</th>
              <th className="py-1.5">PROJ. TDEE</th>
            </tr>
          </thead>
          <tbody>
            {sampledTrajectory.map((pt) => (
              <tr key={pt.week} className="border-b border-[#e2e8f0]">
                <td className="py-1.5 font-bold">W{pt.week}</td>
                <td className="py-1.5">{pt.weightKg.toFixed(1)}</td>
                <td className="py-1.5">{pt.leanMassKg.toFixed(1)}</td>
                <td className="py-1.5">{pt.fatMassKg.toFixed(1)}</td>
                <td className="py-1.5">{pt.bodyFatPct.toFixed(1)}%</td>
                <td className="py-1.5">{pt.projectedTdee} kcal</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weekly Prescribed Split & Active Bookings */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#cbd5e1] p-3 text-xs">
          <div className="font-mono-num text-[10px] font-bold uppercase text-[#475569]">
            03 · WEEKLY VANGUARD TRAINING SPLIT
          </div>
          <ul className="mt-2 space-y-1 font-mono-num">
            <li>Strength Vault: {metabolicResult.weeklyProtocol.strengthSessions}x / week</li>
            <li>HIIT Lab: {metabolicResult.weeklyProtocol.hiitSessions}x / week</li>
            <li>Reformer Pilates: {metabolicResult.weeklyProtocol.pilatesMobility}x / week</li>
            <li>4.8°C Cryo Contrast: {metabolicResult.weeklyProtocol.cryoRecovery}x / week</li>
            <li>
              Daily Steps: {metabolicResult.weeklyProtocol.dailySteps.toLocaleString('en-US')} · Sodium:{' '}
              {metabolicResult.electrolyteSodiumMg} mg
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-[#cbd5e1] p-3 text-xs">
          <div className="font-mono-num text-[10px] font-bold uppercase text-[#475569]">
            04 · LOCKED STUDIO SESSIONS ({lockedSessions.length})
          </div>
          {lockedSessions.length === 0 ? (
            <p className="mt-2 text-[#64748b]">
              No sessions locked yet. Book via Vanguard Timetable.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono-num text-[11px]">
              {lockedSessions.map(({ rec, session }) => (
                <li key={session.id}>
                  [{rec.status.toUpperCase()}] {tTime.days[session.day]} {session.startTime} —{' '}
                  {lang === 'en' ? session.titleEn : session.titleVi} ({session.coachName})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-[#cbd5e1] pt-3 text-center font-mono-num text-[10px] text-[#64748b]">
        VANGUARD BIO-PERFORMANCE CLUB · 88 DONG KHOI (D1) &amp; 24 XUAN THUY (THAO DIEN) · ENGINEERED BY TVT STUDIO
      </div>
    </div>
  );
};
