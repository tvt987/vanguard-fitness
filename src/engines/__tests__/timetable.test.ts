import { describe, expect, it } from 'vitest';
import {
  bookClassSlot,
  cancelClassSlot,
  exportClassToIcs,
  filterClasses,
  getClassAvailability,
  INITIAL_TIMETABLE_STATE,
  matchTrainers,
  WEEKLY_CLASSES,
} from '../timetable';

describe('Timetable Slot Locking, Waitlist & PT Matcher Engine', () => {
  it('filters weekly classes accurately by discipline and day of week', () => {
    const pilatesOnly = filterClasses(WEEKLY_CLASSES, 'reformer_pilates', 'all');
    expect(pilatesOnly.length).toBeGreaterThanOrEqual(3);
    expect(pilatesOnly.every((c) => c.discipline === 'reformer_pilates')).toBe(true);

    const mondayOnly = filterClasses(WEEKLY_CLASSES, 'all', 'mon');
    expect(mondayOnly.length).toBe(3);
    expect(mondayOnly.every((c) => c.day === 'mon')).toBe(true);
  });

  it('books an open spot, decrements remaining seats, and marks booking confirmed', () => {
    const session = WEEKLY_CLASSES.find((c) => c.id === 'mon-0630-hiit')!;
    const before = getClassAvailability(session, INITIAL_TIMETABLE_STATE);
    expect(before.remaining).toBe(2);

    const res = bookClassSlot(session, INITIAL_TIMETABLE_STATE, '2026-11-26T10:00:00Z');
    expect(res.outcome).toBe('confirmed');

    const after = getClassAvailability(session, res.nextState);
    expect(after.remaining).toBe(1);
    expect(after.booked).toBe(before.booked + 1);
    expect(after.userBooking?.status).toBe('confirmed');
  });

  it('transitions a 1-seat-remaining class to full upon booking', () => {
    const session = WEEKLY_CLASSES.find((c) => c.id === 'mon-1830-strength')!;
    expect(getClassAvailability(session, INITIAL_TIMETABLE_STATE).remaining).toBe(1);

    const res = bookClassSlot(session, INITIAL_TIMETABLE_STATE);
    const after = getClassAvailability(session, res.nextState);
    expect(res.outcome).toBe('confirmed');
    expect(after.remaining).toBe(0);
    expect(after.isFull).toBe(true);
  });

  it('automatically places user on waitlist with accurate queue position when class is full', () => {
    const fullClass = WEEKLY_CLASSES.find((c) => c.id === 'mon-0800-pilates')!;
    const before = getClassAvailability(fullClass, INITIAL_TIMETABLE_STATE);
    expect(before.isFull).toBe(true);
    expect(before.waitlistCount).toBe(2);

    const res = bookClassSlot(fullClass, INITIAL_TIMETABLE_STATE);
    expect(res.outcome).toBe('waitlist');
    expect(res.waitlistPosition).toBe(3);

    const after = getClassAvailability(fullClass, res.nextState);
    expect(after.waitlistCount).toBe(3);
    expect(after.userBooking?.status).toBe('waitlist');
    expect(after.userBooking?.waitlistPosition).toBe(3);
  });

  it('prevents duplicate booking for the same class without altering seat counts', () => {
    const session = WEEKLY_CLASSES.find((c) => c.id === 'tue-0700-cryo')!;
    const first = bookClassSlot(session, INITIAL_TIMETABLE_STATE);
    const second = bookClassSlot(session, first.nextState);

    expect(second.outcome).toBe('already_booked');
    expect(getClassAvailability(session, second.nextState).booked).toBe(
      getClassAvailability(session, first.nextState).booked
    );
  });

  it('restores remaining seat capacity when cancelling a confirmed booking', () => {
    const session = WEEKLY_CLASSES.find((c) => c.id === 'mon-1830-strength')!;
    const booked = bookClassSlot(session, INITIAL_TIMETABLE_STATE);
    expect(getClassAvailability(session, booked.nextState).isFull).toBe(true);

    const cancelled = cancelClassSlot(session, booked.nextState);
    expect(cancelled.removedStatus).toBe('confirmed');
    const after = getClassAvailability(session, cancelled.nextState);
    expect(after.isFull).toBe(false);
    expect(after.remaining).toBe(1);
    expect(after.userBooking).toBeNull();
  });

  it('decrements waitlist counter cleanly when cancelling a waitlisted spot', () => {
    const fullClass = WEEKLY_CLASSES.find((c) => c.id === 'wed-1800-cryo')!;
    const waitlisted = bookClassSlot(fullClass, INITIAL_TIMETABLE_STATE);
    expect(getClassAvailability(fullClass, waitlisted.nextState).waitlistCount).toBe(2);

    const cancelled = cancelClassSlot(fullClass, waitlisted.nextState);
    expect(cancelled.removedStatus).toBe('waitlist');
    const after = getClassAvailability(fullClass, cancelled.nextState);
    expect(after.waitlistCount).toBe(1);
    expect(after.booked).toBe(fullClass.capacity);
  });

  it('ranks specialized Personal Trainers highest for aligned goal, discipline & time window', () => {
    const hypertrophyMatch = matchTrainers({
      goal: 'hypertrophy',
      preferredDiscipline: 'strength_barbell',
      window: 'evening',
    });
    expect(hypertrophyMatch[0].id).toBe('coach-minh-khoa');
    expect(hypertrophyMatch[0].matchScore).toBeGreaterThanOrEqual(95);

    const pilatesRecompMatch = matchTrainers({
      goal: 'lean_recomp',
      preferredDiscipline: 'reformer_pilates',
      window: 'morning',
    });
    expect(pilatesRecompMatch[0].id).toBe('coach-claire-vu');
    expect(pilatesRecompMatch[0].matchScore).toBeGreaterThanOrEqual(94);

    const enduranceMatch = matchTrainers({
      goal: 'endurance',
      preferredDiscipline: 'hiit_lab',
      window: 'morning',
    });
    expect(enduranceMatch[0].id).toBe('coach-marcus-reed');
  });

  it('exports standards-compliant RFC 5545 .ics calendar payload for any class', () => {
    const session = WEEKLY_CLASSES[0];
    const ics = exportClassToIcs(session);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain(`SUMMARY:VANGUARD · ${session.titleEn}`);
    expect(ics).toContain('DTSTART:');
    expect(ics).toContain('DTEND:');
    expect(ics).toContain('END:VCALENDAR');
  });
});
