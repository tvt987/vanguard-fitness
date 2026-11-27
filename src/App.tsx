import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import type { ClubLocationId } from './components/MembershipSection';
import { Navbar } from './components/Navbar';
import type {
  AddOnId,
  BillingCycle,
  CurrencyCode,
  MembershipTierId,
} from './engines/membership';
import {
  buildVietQrCheckout,
  calculateMembershipQuote,
} from './engines/membership';
import type { MetabolicInput } from './engines/metabolic';
import { computeMetabolicProfile } from './engines/metabolic';
import type { PeriodizationInput } from './engines/periodizationEngine';
import type { ClassSession, TimetableBookingState } from './engines/timetable';
import {
  bookClassSlot,
  cancelClassSlot,
  INITIAL_TIMETABLE_STATE,
  VANGUARD_TRAINERS,
} from './engines/timetable';
import type { Lang } from './i18n/translations';

const MetabolicLabSection = lazy(() =>
  import('./components/MetabolicLabSection').then((m) => ({
    default: m.MetabolicLabSection,
  }))
);
const PeriodizationBuilderLab = lazy(() =>
  import('./components/PeriodizationBuilderLab')
);
const SpacesSection = lazy(() =>
  import('./components/SpacesSection').then((m) => ({
    default: m.SpacesSection,
  }))
);
const TimetableSection = lazy(() =>
  import('./components/TimetableSection').then((m) => ({
    default: m.TimetableSection,
  }))
);
const TrainersSection = lazy(() =>
  import('./components/TrainersSection').then((m) => ({
    default: m.TrainersSection,
  }))
);
const MembershipSection = lazy(() =>
  import('./components/MembershipSection').then((m) => ({
    default: m.MembershipSection,
  }))
);
const PrintableBlueprintSheet = lazy(() =>
  import('./components/PrintableBlueprintSheet').then((m) => ({
    default: m.PrintableBlueprintSheet,
  }))
);

const STORAGE_KEY = 'vanguard-fitness-state-v2';

interface PersistedPreferences {
  lang: Lang;
  currency: CurrencyCode;
  dark: boolean;
  metabolicInput: MetabolicInput;
  periodizationInput: PeriodizationInput;
  timetableState: TimetableBookingState;
  selectedCoachId: string;
  tierId: MembershipTierId;
  billingCycle: BillingCycle;
  selectedAddOns: AddOnId[];
  memberName: string;
  memberEmail: string;
  homeClub: ClubLocationId;
  passActivated: boolean;
}

const DEFAULT_PREFS: PersistedPreferences = {
  lang: 'en',
  currency: 'VND',
  dark: false,
  metabolicInput: {
    sex: 'male',
    age: 29,
    weightKg: 78,
    heightCm: 178,
    bodyFatPct: 17,
    activity: 'moderate',
    goal: 'lean_recomp',
  },
  periodizationInput: {
    goal: 'hypertrophy_volume',
    daysPerWeek: 4,
    experience: 'intermediate',
    oneRepMax: {
      squatKg: 140,
      benchKg: 100,
      deadliftKg: 175,
    },
  },
  timetableState: INITIAL_TIMETABLE_STATE,
  selectedCoachId: VANGUARD_TRAINERS[0].id,
  tierId: 'performance',
  billingCycle: 'annual',
  selectedAddOns: [],
  memberName: 'Nguyen Minh Anh',
  memberEmail: 'minhanh@vanguard.club',
  homeClub: 'd1',
  passActivated: false,
};

function loadInitialPreferences(): PersistedPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      metabolicInput: {
        ...DEFAULT_PREFS.metabolicInput,
        ...(parsed.metabolicInput ?? {}),
      },
      periodizationInput: {
        ...DEFAULT_PREFS.periodizationInput,
        ...(parsed.periodizationInput ?? {}),
        oneRepMax: {
          ...DEFAULT_PREFS.periodizationInput.oneRepMax,
          ...(parsed.periodizationInput?.oneRepMax ?? {}),
        },
      },
      timetableState: {
        ...INITIAL_TIMETABLE_STATE,
        ...(parsed.timetableState ?? {}),
      },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const SectionFallback: React.FC<{ id?: string; heightClass?: string }> = ({
  id,
  heightClass = 'min-h-[320px]',
}) => (
  <section
    id={id}
    className={`no-print border-b border-[var(--vg-border)] py-14 ${heightClass}`}
    aria-busy="true"
  >
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="h-4 w-48 animate-pulse rounded bg-[var(--vg-surface-alt)]" />
      <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded bg-[var(--vg-surface-alt)]" />
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] lg:col-span-5" />
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] lg:col-span-7" />
      </div>
    </div>
  </section>
);

export const App: React.FC = () => {
  const [prefs, setPrefs] = useState<PersistedPreferences>(loadInitialPreferences);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.dark);
    document.documentElement.lang = prefs.lang;
  }, [prefs.dark, prefs.lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota / private-mode restrictions
    }
  }, [prefs]);

  const metabolicResult = useMemo(
    () => computeMetabolicProfile(prefs.metabolicInput),
    [prefs.metabolicInput]
  );

  const quote = useMemo(
    () =>
      calculateMembershipQuote(
        prefs.tierId,
        prefs.billingCycle,
        prefs.selectedAddOns
      ),
    [prefs.tierId, prefs.billingCycle, prefs.selectedAddOns]
  );

  const vietQr = useMemo(
    () => buildVietQrCheckout(quote, prefs.memberName),
    [quote, prefs.memberName]
  );

  const assignedCoach = useMemo(
    () =>
      VANGUARD_TRAINERS.find((c) => c.id === prefs.selectedCoachId) ??
      VANGUARD_TRAINERS[0],
    [prefs.selectedCoachId]
  );

  const activeBookingCount = Object.keys(prefs.timetableState.bookings).length;

  const handleBookClass = (session: ClassSession) => {
    setPrefs((prev) => ({
      ...prev,
      timetableState: bookClassSlot(session, prev.timetableState).nextState,
    }));
  };

  const handleCancelClass = (session: ClassSession) => {
    setPrefs((prev) => ({
      ...prev,
      timetableState: cancelClassSlot(session, prev.timetableState).nextState,
    }));
  };

  const handleResetTimetable = () => {
    setPrefs((prev) => ({
      ...prev,
      timetableState: INITIAL_TIMETABLE_STATE,
    }));
  };

  const handleToggleAddOn = (addonId: AddOnId) => {
    setPrefs((prev) => {
      const exists = prev.selectedAddOns.includes(addonId);
      return {
        ...prev,
        selectedAddOns: exists
          ? prev.selectedAddOns.filter((id) => id !== addonId)
          : [...prev.selectedAddOns, addonId],
      };
    });
  };

  const handlePrintBlueprint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[var(--vg-bg)] text-[var(--vg-ink)] transition-colors duration-200">
      <Navbar
        lang={prefs.lang}
        setLang={(lang) => setPrefs((p) => ({ ...p, lang }))}
        currency={prefs.currency}
        setCurrency={(currency) => setPrefs((p) => ({ ...p, currency }))}
        dark={prefs.dark}
        setDark={(dark) => setPrefs((p) => ({ ...p, dark }))}
        activeBookingCount={activeBookingCount}
      />

      <main>
        <HeroSection
          lang={prefs.lang}
          readinessScore={metabolicResult.readinessScore}
          targetCalories={metabolicResult.targetCalories}
        />

        <Suspense fallback={<SectionFallback id="metabolic-lab" />}>
          <MetabolicLabSection
            lang={prefs.lang}
            input={prefs.metabolicInput}
            onChangeInput={(metabolicInput) =>
              setPrefs((p) => ({ ...p, metabolicInput }))
            }
            result={metabolicResult}
            onPrintBlueprint={handlePrintBlueprint}
          />
        </Suspense>

        <Suspense fallback={<SectionFallback id="periodization-lab" />}>
          <PeriodizationBuilderLab
            lang={prefs.lang}
            input={prefs.periodizationInput}
            onChangeInput={(periodizationInput) =>
              setPrefs((p) => ({ ...p, periodizationInput }))
            }
          />
        </Suspense>

        <Suspense fallback={<SectionFallback id="sanctuaries" />}>
          <SpacesSection lang={prefs.lang} />
        </Suspense>

        <Suspense fallback={<SectionFallback id="timetable" />}>
          <TimetableSection
            lang={prefs.lang}
            bookingState={prefs.timetableState}
            onBook={handleBookClass}
            onCancel={handleCancelClass}
            onResetAll={handleResetTimetable}
          />
        </Suspense>

        <Suspense fallback={<SectionFallback id="specialists" />}>
          <TrainersSection
            lang={prefs.lang}
            currency={prefs.currency}
            activeGoal={prefs.metabolicInput.goal}
            selectedCoachId={prefs.selectedCoachId}
            onSelectCoach={(selectedCoachId) =>
              setPrefs((p) => ({ ...p, selectedCoachId }))
            }
          />
        </Suspense>

        <Suspense fallback={<SectionFallback id="membership" />}>
          <MembershipSection
            lang={prefs.lang}
            currency={prefs.currency}
            tierId={prefs.tierId}
            onSelectTier={(tierId) => setPrefs((p) => ({ ...p, tierId }))}
            billingCycle={prefs.billingCycle}
            onChangeBillingCycle={(billingCycle) =>
              setPrefs((p) => ({ ...p, billingCycle }))
            }
            selectedAddOns={prefs.selectedAddOns}
            onToggleAddOn={handleToggleAddOn}
            quote={quote}
            vietQr={vietQr}
            memberName={prefs.memberName}
            onChangeMemberName={(memberName) =>
              setPrefs((p) => ({ ...p, memberName }))
            }
            memberEmail={prefs.memberEmail}
            onChangeMemberEmail={(memberEmail) =>
              setPrefs((p) => ({ ...p, memberEmail }))
            }
            homeClub={prefs.homeClub}
            onChangeHomeClub={(homeClub) => setPrefs((p) => ({ ...p, homeClub }))}
            passActivated={prefs.passActivated}
            onActivatePass={() => setPrefs((p) => ({ ...p, passActivated: true }))}
            assignedCoach={assignedCoach}
            metabolicResult={metabolicResult}
            activeBookingCount={activeBookingCount}
            onPrintBlueprint={handlePrintBlueprint}
          />
        </Suspense>
      </main>

      <Footer lang={prefs.lang} />

      <Suspense fallback={null}>
        <PrintableBlueprintSheet
          lang={prefs.lang}
          currency={prefs.currency}
          memberName={prefs.memberName}
          memberEmail={prefs.memberEmail}
          homeClub={prefs.homeClub}
          passActivated={prefs.passActivated}
          quote={quote}
          vietQr={vietQr}
          assignedCoach={assignedCoach}
          metabolicInput={prefs.metabolicInput}
          metabolicResult={metabolicResult}
          bookingState={prefs.timetableState}
        />
      </Suspense>
    </div>
  );
};

export default App;
