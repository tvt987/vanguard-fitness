import React, { useMemo, useState } from 'react';
import type {
  ClassSession,
  DayOfWeek,
  DisciplineId,
  TimetableBookingState,
} from '../engines/timetable';
import {
  exportClassToIcs,
  filterClasses,
  getClassAvailability,
  WEEKLY_CLASSES,
} from '../engines/timetable';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import {
  CalendarIcon,
  CheckIcon,
  DumbbellIcon,
  FlameIcon,
  PulseIcon,
  SnowflakeIcon,
} from './Icons';

interface TimetableSectionProps {
  lang: Lang;
  bookingState: TimetableBookingState;
  onBook: (session: ClassSession) => void;
  onCancel: (session: ClassSession) => void;
  onResetAll: () => void;
}

const DISCIPLINES: Array<DisciplineId | 'all'> = [
  'all',
  'hiit_lab',
  'reformer_pilates',
  'strength_barbell',
  'cryo_recovery',
];

const DAYS: Array<DayOfWeek | 'all'> = [
  'all',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

const DISCIPLINE_STYLES: Record<
  DisciplineId,
  { badge: string; bar: string; icon: React.FC<{ className?: string }> }
> = {
  hiit_lab: {
    badge: 'border-[#f97316]/35 bg-[#f97316]/12 text-[#f97316]',
    bar: 'bg-[#f97316]',
    icon: FlameIcon,
  },
  reformer_pilates: {
    badge: 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)]',
    bar: 'bg-[#a3e635]',
    icon: PulseIcon,
  },
  strength_barbell: {
    badge: 'border-[#a3e635]/40 bg-[#a3e635]/12 text-[var(--vg-accent)]',
    bar: 'bg-[#a3e635]',
    icon: DumbbellIcon,
  },
  cryo_recovery: {
    badge: 'border-[#38bdf8]/40 bg-[#38bdf8]/12 text-[var(--vg-cryo)]',
    bar: 'bg-[#38bdf8]',
    icon: SnowflakeIcon,
  },
};

export const TimetableSection: React.FC<TimetableSectionProps> = ({
  lang,
  bookingState,
  onBook,
  onCancel,
  onResetAll,
}) => {
  const t = COPY[lang].timetable;
  const [selectedDiscipline, setSelectedDiscipline] = useState<
    DisciplineId | 'all'
  >('all');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');

  const filteredSessions = useMemo(
    () => filterClasses(WEEKLY_CLASSES, selectedDiscipline, selectedDay),
    [selectedDiscipline, selectedDay]
  );

  const activeBookings = useMemo(() => {
    return Object.values(bookingState.bookings)
      .map((record) => {
        const session = WEEKLY_CLASSES.find((c) => c.id === record.classId);
        return session ? { record, session } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [bookingState.bookings]);

  const handleDownloadIcs = (session: ClassSession) => {
    const ics = exportClassToIcs(session);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vanguard-${session.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="timetable"
      className="no-print border-b border-[var(--vg-border)] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
              {t.eyebrow}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--vg-muted)]">{t.subtitle}</p>
          </div>
          {activeBookings.length > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="self-start rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2 font-mono-num text-[11px] font-semibold text-[var(--vg-muted)] transition-colors hover:border-[var(--vg-accent)] hover:text-[var(--vg-ink)] md:self-auto cursor-pointer"
            >
              {t.clearAll}
            </button>
          )}
        </div>

        {/* Active Bookings Summary Strip */}
        <div
          data-testid="active-bookings-strip"
          className="mt-6 rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#a3e635]" />
              <span className="font-mono-num text-xs font-bold tracking-[0.12em] uppercase text-[var(--vg-ink)]">
                {t.mySchedule}
              </span>
              <span className="rounded-md bg-[var(--vg-surface-alt)] px-2 py-0.5 font-mono-num text-[11px] font-bold text-[var(--vg-accent)]">
                {activeBookings.length}
              </span>
            </div>
          </div>

          {activeBookings.length === 0 ? (
            <p className="mt-2.5 text-xs text-[var(--vg-muted)]">{t.noBookings}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {activeBookings.map(({ record, session }) => {
                const isWaitlist = record.status === 'waitlist';
                return (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-3 py-2 text-xs"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold ${
                        isWaitlist
                          ? 'bg-[#f97316]/20 text-[#f97316]'
                          : 'bg-[#a3e635]/20 text-[var(--vg-accent)]'
                      }`}
                    >
                      {isWaitlist
                        ? `${t.waitlistTag} #${record.waitlistPosition ?? 1}`
                        : t.confirmedTag}
                    </span>
                    <span className="font-mono-num font-bold text-[var(--vg-ink)]">
                      {t.days[session.day]} {session.startTime}
                    </span>
                    <span className="font-semibold text-[var(--vg-ink)]">
                      {lang === 'en' ? session.titleEn : session.titleVi}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(session)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--vg-ink)] hover:border-[var(--vg-accent)] cursor-pointer"
                      aria-label={`Download calendar file for ${session.titleEn}`}
                    >
                      <CalendarIcon className="h-3 w-3 text-[var(--vg-accent)]" />
                      <span>{t.addCalendar}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancel(session)}
                      className="rounded border border-[var(--vg-border)] px-2 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--vg-muted)] hover:border-[#f97316] hover:text-[#f97316] cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter Bar: Disciplines & Days */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Discipline Pills */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by discipline">
            {DISCIPLINES.map((disc) => {
              const active = selectedDiscipline === disc;
              const label =
                disc === 'all' ? t.allDisciplines : t.disciplines[disc];
              return (
                <button
                  key={disc}
                  type="button"
                  data-testid={`discipline-filter-${disc}`}
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-[#a3e635] bg-[#a3e635] text-[#08090c]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-muted)] hover:border-[var(--vg-accent)] hover:text-[var(--vg-ink)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Day of Week Pills */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by day">
            {DAYS.map((day) => {
              const active = selectedDay === day;
              const label = day === 'all' ? t.allDays : t.days[day];
              return (
                <button
                  key={day}
                  type="button"
                  data-testid={`day-filter-${day}`}
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-lg border px-2.5 py-1.5 font-mono-num text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-[var(--vg-ink)] bg-[var(--vg-ink)] text-[var(--vg-bg)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-muted)] hover:border-[var(--vg-accent)] hover:text-[var(--vg-ink)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timetable Cards Grid */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSessions.map((session) => {
            const avail = getClassAvailability(session, bookingState);
            const style = DISCIPLINE_STYLES[session.discipline];
            const DiscIcon = style.icon;
            const userBooking = avail.userBooking;

            const isConfirmed = userBooking?.status === 'confirmed';
            const isWaitlisted = userBooking?.status === 'waitlist';

            return (
              <article
                key={session.id}
                data-testid={`class-card-${session.id}`}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isConfirmed
                    ? 'border-[#a3e635] bg-[var(--vg-surface)] shadow-[0_0_0_1px_rgba(163,230,53,0.25)]'
                    : isWaitlisted
                      ? 'border-[#f97316]/70 bg-[var(--vg-surface)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-[var(--vg-accent)]/60'
                }`}
              >
                <div>
                  {/* Top Meta: Day/Time + Discipline Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[var(--vg-surface-alt)] px-2 py-1 font-mono-num text-[11px] font-bold text-[var(--vg-ink)]">
                        {t.days[session.day]}
                      </span>
                      <span className="font-mono-num text-sm font-bold text-[var(--vg-ink)]">
                        {session.startTime}
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--vg-muted)]">
                        · {session.durationMin}m
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono-num text-[10px] font-semibold ${style.badge}`}
                    >
                      <DiscIcon className="h-3 w-3" />
                      <span>{t.disciplines[session.discipline]}</span>
                    </span>
                  </div>

                  {/* Title & Studio Details */}
                  <h3 className="font-display mt-3.5 text-lg font-bold leading-snug text-[var(--vg-ink)]">
                    {lang === 'en' ? session.titleEn : session.titleVi}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--vg-muted)]">
                    <span className="font-medium text-[var(--vg-ink)]">
                      {session.coachName}
                    </span>
                    <span>·</span>
                    <span>{session.studioZone}</span>
                  </div>

                  {/* Intensity + Est Burn */}
                  <div className="mt-3 flex items-center justify-between font-mono-num text-[11px]">
                    <span className="rounded bg-[var(--vg-surface-alt)] px-2 py-0.5 text-[var(--vg-muted)]">
                      {session.intensity.toUpperCase()}
                    </span>
                    <span className="text-[var(--vg-muted)]">
                      ~{session.caloriesEst} kcal {t.estBurn}
                    </span>
                  </div>

                  {/* Live Capacity Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between font-mono-num text-[11px]">
                      {avail.isFull ? (
                        <span className="font-bold text-[#f97316]">
                          {t.classFull}
                          {avail.waitlistCount > 0
                            ? ` (${avail.waitlistCount} ${t.waitlistLabel})`
                            : ''}
                        </span>
                      ) : (
                        <span className="font-bold text-[var(--vg-accent)]">
                          {avail.remaining} {t.seatsLeft}
                        </span>
                      )}
                      <span className="text-[var(--vg-muted)]">
                        {avail.booked}/{avail.capacity}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-surface-alt)]">
                      <div
                        style={{ width: `${avail.occupancyPct}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          avail.isFull ? 'bg-[#f97316]' : style.bar
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="mt-5 flex items-center gap-2">
                  {userBooking ? (
                    <button
                      type="button"
                      data-testid={`book-btn-${session.id}`}
                      onClick={() => onCancel(session)}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isConfirmed
                          ? 'border-[#a3e635] bg-[#a3e635]/15 text-[var(--vg-accent)] hover:bg-[#a3e635]/25'
                          : 'border-[#f97316]/60 bg-[#f97316]/12 text-[#f97316] hover:bg-[#f97316]/20'
                      }`}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      <span>
                        {isConfirmed
                          ? t.confirmedBtn
                          : t.waitlistedBtn.replace(
                              '{pos}',
                              String(userBooking.waitlistPosition ?? 1)
                            )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid={`book-btn-${session.id}`}
                      onClick={() => onBook(session)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                        avail.isFull
                          ? 'border border-[#f97316]/50 bg-[#f97316]/12 text-[#f97316] hover:bg-[#f97316]/20'
                          : 'bg-[#a3e635] text-[#08090c] hover:brightness-105 active:scale-[0.98]'
                      }`}
                    >
                      {avail.isFull ? t.joinWaitlist : t.bookSeat}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownloadIcs(session)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-2 font-mono-num text-[11px] font-semibold text-[var(--vg-ink)] transition-colors hover:border-[var(--vg-accent)] cursor-pointer"
                    title="Export .ICS Calendar Invite"
                    aria-label={`Export ${session.titleEn} to .ICS calendar`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                    <span>{t.addCalendar}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
