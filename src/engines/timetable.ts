import type { TrainingGoal } from './metabolic';

export type DisciplineId =
  | 'hiit_lab'
  | 'reformer_pilates'
  | 'strength_barbell'
  | 'cryo_recovery';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type ScheduleWindow = 'morning' | 'midday' | 'evening';

export interface ClassSession {
  id: string;
  discipline: DisciplineId;
  day: DayOfWeek;
  startTime: string; // HH:MM 24h
  durationMin: number;
  titleEn: string;
  titleVi: string;
  studioZone: string;
  coachName: string;
  intensity: 'Low' | 'Moderate' | 'High' | 'Peak';
  capacity: number;
  initialBooked: number;
  initialWaitlist: number;
  caloriesEst: number;
}

export interface UserBookingRecord {
  classId: string;
  status: 'confirmed' | 'waitlist';
  waitlistPosition?: number;
  bookedAt: string;
}

export interface TimetableBookingState {
  bookings: Record<string, UserBookingRecord>;
  seatDelta: Record<string, number>;
  waitlistDelta: Record<string, number>;
}

export interface SlotAvailability {
  capacity: number;
  booked: number;
  remaining: number;
  isFull: boolean;
  waitlistCount: number;
  occupancyPct: number;
  userBooking: UserBookingRecord | null;
}

export interface BookActionResult {
  nextState: TimetableBookingState;
  outcome: 'confirmed' | 'waitlist' | 'already_booked';
  waitlistPosition?: number;
}

export interface TrainerProfile {
  id: string;
  name: string;
  initials: string;
  titleEn: string;
  titleVi: string;
  credentials: string[];
  experienceYears: number;
  languages: string[];
  hourlyRateVnd: number;
  goalWeights: Record<TrainingGoal, number>;
  disciplines: DisciplineId[];
  windows: ScheduleWindow[];
  signatureEn: string;
  signatureVi: string;
  accentHue: string;
}

export interface TrainerMatchCriteria {
  goal: TrainingGoal;
  preferredDiscipline: DisciplineId | 'all';
  window: ScheduleWindow;
}

export interface MatchedTrainer extends TrainerProfile {
  matchScore: number;
  matchedReasonsEn: string[];
  matchedReasonsVi: string[];
}

export const INITIAL_TIMETABLE_STATE: TimetableBookingState = {
  bookings: {},
  seatDelta: {},
  waitlistDelta: {},
};

export const WEEKLY_CLASSES: ClassSession[] = [
  {
    id: 'mon-0630-hiit',
    discipline: 'hiit_lab',
    day: 'mon',
    startTime: '06:30',
    durationMin: 45,
    titleEn: 'VO2 Max MetCon Lab',
    titleVi: 'VO2 Max Đốt Mỡ Cường Độ Cao',
    studioZone: 'Turf Lab · Floor 2',
    coachName: 'Marcus Reed',
    intensity: 'Peak',
    capacity: 14,
    initialBooked: 12,
    initialWaitlist: 0,
    caloriesEst: 640,
  },
  {
    id: 'mon-0800-pilates',
    discipline: 'reformer_pilates',
    day: 'mon',
    startTime: '08:00',
    durationMin: 50,
    titleEn: 'Kinetic Reformer Core',
    titleVi: 'Reformer Pilates Cốt Lõi',
    studioZone: 'Pilates Atelier · Floor 3',
    coachName: 'Claire Vu',
    intensity: 'Moderate',
    capacity: 10,
    initialBooked: 10,
    initialWaitlist: 2,
    caloriesEst: 310,
  },
  {
    id: 'mon-1830-strength',
    discipline: 'strength_barbell',
    day: 'mon',
    startTime: '18:30',
    durationMin: 60,
    titleEn: 'Barbell Force & Hypertrophy',
    titleVi: 'Sức Mạnh Thanh Đòn & Tăng Cơ',
    studioZone: 'Iron Vault · Floor 1',
    coachName: 'Minh Khoa',
    intensity: 'High',
    capacity: 12,
    initialBooked: 11,
    initialWaitlist: 0,
    caloriesEst: 480,
  },
  {
    id: 'tue-0700-cryo',
    discipline: 'cryo_recovery',
    day: 'tue',
    startTime: '07:00',
    durationMin: 40,
    titleEn: 'Contrast Plunge 4.8°C + Infrared',
    titleVi: 'Ngâm Lạnh 4.8°C & Xông Hồng Ngoại',
    studioZone: 'Basalt Sanctuary · Floor 4',
    coachName: 'Hana Tran',
    intensity: 'Low',
    capacity: 8,
    initialBooked: 6,
    initialWaitlist: 0,
    caloriesEst: 180,
  },
  {
    id: 'tue-1215-pilates',
    discipline: 'reformer_pilates',
    day: 'tue',
    startTime: '12:15',
    durationMin: 45,
    titleEn: 'Executive Spine & Posture Alignment',
    titleVi: 'Reformer Cân Bằng Cột Sống',
    studioZone: 'Pilates Atelier · Floor 3',
    coachName: 'Claire Vu',
    intensity: 'Moderate',
    capacity: 10,
    initialBooked: 8,
    initialWaitlist: 0,
    caloriesEst: 280,
  },
  {
    id: 'tue-1900-hiit',
    discipline: 'hiit_lab',
    day: 'tue',
    startTime: '19:00',
    durationMin: 45,
    titleEn: 'Anaerobic Threshold Sled & Erg',
    titleVi: 'Kéo Xe Trượt & Erg Ngưỡng Kỵ Khí',
    studioZone: 'Turf Lab · Floor 2',
    coachName: 'Linh Nguyen',
    intensity: 'Peak',
    capacity: 14,
    initialBooked: 13,
    initialWaitlist: 0,
    caloriesEst: 670,
  },
  {
    id: 'wed-0630-strength',
    discipline: 'strength_barbell',
    day: 'wed',
    startTime: '06:30',
    durationMin: 60,
    titleEn: 'Olympic Lifting Velocity Lab',
    titleVi: 'Kỹ Thuật Cử Tạ Olympic & Tốc Độ',
    studioZone: 'Iron Vault · Floor 1',
    coachName: 'Duc Anh',
    intensity: 'High',
    capacity: 10,
    initialBooked: 9,
    initialWaitlist: 0,
    caloriesEst: 510,
  },
  {
    id: 'wed-1800-cryo',
    discipline: 'cryo_recovery',
    day: 'wed',
    startTime: '18:00',
    durationMin: 45,
    titleEn: 'HRV Breathwork & Cold Immersion',
    titleVi: 'Hơi Thở Tối Ưu HRV & Ngâm Lạnh',
    studioZone: 'Basalt Sanctuary · Floor 4',
    coachName: 'Hana Tran',
    intensity: 'Low',
    capacity: 8,
    initialBooked: 8,
    initialWaitlist: 1,
    caloriesEst: 160,
  },
  {
    id: 'thu-0730-pilates',
    discipline: 'reformer_pilates',
    day: 'thu',
    startTime: '07:30',
    durationMin: 50,
    titleEn: 'Athletic Reformer Power',
    titleVi: 'Reformer Kháng Lực Thể Thao',
    studioZone: 'Pilates Atelier · Floor 3',
    coachName: 'Claire Vu',
    intensity: 'High',
    capacity: 10,
    initialBooked: 7,
    initialWaitlist: 0,
    caloriesEst: 360,
  },
  {
    id: 'thu-1830-hiit',
    discipline: 'hiit_lab',
    day: 'thu',
    startTime: '18:30',
    durationMin: 45,
    titleEn: 'Zone 4-5 Metabolic Engine',
    titleVi: 'Động Cơ Chuyển Hóa Zone 4-5',
    studioZone: 'Turf Lab · Floor 2',
    coachName: 'Marcus Reed',
    intensity: 'Peak',
    capacity: 16,
    initialBooked: 14,
    initialWaitlist: 0,
    caloriesEst: 650,
  },
  {
    id: 'fri-0645-strength',
    discipline: 'strength_barbell',
    day: 'fri',
    startTime: '06:45',
    durationMin: 60,
    titleEn: 'Posterior Chain & Deadlift Clinic',
    titleVi: 'Chuỗi Cơ Sau & Kỹ Thuật Deadlift',
    studioZone: 'Iron Vault · Floor 1',
    coachName: 'Minh Khoa',
    intensity: 'High',
    capacity: 12,
    initialBooked: 9,
    initialWaitlist: 0,
    caloriesEst: 520,
  },
  {
    id: 'fri-1730-cryo',
    discipline: 'cryo_recovery',
    day: 'fri',
    startTime: '17:30',
    durationMin: 45,
    titleEn: 'Friday Decompression Sauna + Plunge',
    titleVi: 'Phục Hồi Cuối Tuần Sauna & Bể Lạnh',
    studioZone: 'Basalt Sanctuary · Floor 4',
    coachName: 'Hana Tran',
    intensity: 'Low',
    capacity: 8,
    initialBooked: 5,
    initialWaitlist: 0,
    caloriesEst: 170,
  },
  {
    id: 'sat-0830-hiit',
    discipline: 'hiit_lab',
    day: 'sat',
    startTime: '08:30',
    durationMin: 55,
    titleEn: 'HYROX Simulation Partner Circuit',
    titleVi: 'Mô Phỏng Thi Đấu HYROX Đồng Đội',
    studioZone: 'Turf Lab · Floor 2',
    coachName: 'Linh Nguyen',
    intensity: 'Peak',
    capacity: 16,
    initialBooked: 15,
    initialWaitlist: 0,
    caloriesEst: 760,
  },
  {
    id: 'sat-1030-pilates',
    discipline: 'reformer_pilates',
    day: 'sat',
    startTime: '10:30',
    durationMin: 50,
    titleEn: 'Reformer Lengthen & Sculpt',
    titleVi: 'Reformer Kéo Giãn & Định Hình Cơ',
    studioZone: 'Pilates Atelier · Floor 3',
    coachName: 'Claire Vu',
    intensity: 'Moderate',
    capacity: 10,
    initialBooked: 8,
    initialWaitlist: 0,
    caloriesEst: 320,
  },
  {
    id: 'sun-0900-strength',
    discipline: 'strength_barbell',
    day: 'sun',
    startTime: '09:00',
    durationMin: 60,
    titleEn: 'Full-Body Structural Strength',
    titleVi: 'Sức Mạnh Toàn Thân Nền Tảng',
    studioZone: 'Iron Vault · Floor 1',
    coachName: 'Duc Anh',
    intensity: 'Moderate',
    capacity: 12,
    initialBooked: 7,
    initialWaitlist: 0,
    caloriesEst: 460,
  },
  {
    id: 'sun-1100-cryo',
    discipline: 'cryo_recovery',
    day: 'sun',
    startTime: '11:00',
    durationMin: 50,
    titleEn: 'Sunday Longevity Contrast Circuit',
    titleVi: 'Chu Trình Tương Phản Trường Thọ',
    studioZone: 'Basalt Sanctuary · Floor 4',
    coachName: 'Hana Tran',
    intensity: 'Low',
    capacity: 8,
    initialBooked: 6,
    initialWaitlist: 0,
    caloriesEst: 190,
  },
];

export const VANGUARD_TRAINERS: TrainerProfile[] = [
  {
    id: 'coach-minh-khoa',
    name: 'Minh Khoa',
    initials: 'MK',
    titleEn: 'Head of Strength & Hypertrophy',
    titleVi: 'Trưởng Bộ Môn Sức Mạnh & Tăng Cơ',
    credentials: ['NSCA-CSCS', 'Exos Performance', 'Precision Nutrition L2'],
    experienceYears: 9,
    languages: ['VI', 'EN'],
    hourlyRateVnd: 1350000,
    goalWeights: { hypertrophy: 98, lean_recomp: 92, fat_loss: 82, endurance: 68 },
    disciplines: ['strength_barbell', 'hiit_lab'],
    windows: ['morning', 'evening'],
    signatureEn: 'Velocity-based barbell programming & hypertrophy periodization',
    signatureVi: 'Lập trình thanh đòn theo vận tốc & chu kỳ hóa tăng cơ chuẩn khoa học',
    accentHue: '#a3e635',
  },
  {
    id: 'coach-claire-vu',
    name: 'Claire Vu',
    initials: 'CV',
    titleEn: 'Master Reformer Pilates Director',
    titleVi: 'Giám Đốc Chuyên Môn Reformer Pilates',
    credentials: ['STOTT Pilates Lead', 'Polestar Rehab', 'Pre/Post-Natal'],
    experienceYears: 8,
    languages: ['EN', 'VI', 'FR'],
    hourlyRateVnd: 1450000,
    goalWeights: { lean_recomp: 96, fat_loss: 85, endurance: 78, hypertrophy: 70 },
    disciplines: ['reformer_pilates', 'cryo_recovery'],
    windows: ['morning', 'midday'],
    signatureEn: 'Biomechanical core architecture, spinal decompression & lean toning',
    signatureVi: 'Kiến trúc cơ lõi sinh cơ học, giải áp cột sống & săn chắc cơ tinh gọn',
    accentHue: '#e2e8f0',
  },
  {
    id: 'coach-marcus-reed',
    name: 'Marcus Reed',
    initials: 'MR',
    titleEn: 'VO2 Max & Metabolic Lab Lead',
    titleVi: 'Chuyên Gia VO2 Max & Chuyển Hóa',
    credentials: ['ACSM-EP', 'HYROX Pro Coach', 'Lactate Testing Cert'],
    experienceYears: 11,
    languages: ['EN'],
    hourlyRateVnd: 1550000,
    goalWeights: { endurance: 99, fat_loss: 94, lean_recomp: 84, hypertrophy: 65 },
    disciplines: ['hiit_lab', 'cryo_recovery'],
    windows: ['morning', 'evening'],
    signatureEn: 'Lactate threshold profiling, Zone-2 aerobic base & HYROX engine building',
    signatureVi: 'Đo ngưỡng lactate, xây nền hiếu khí Zone 2 & động cơ thi đấu HYROX',
    accentHue: '#f97316',
  },
  {
    id: 'coach-duc-anh',
    name: 'Duc Anh',
    initials: 'DA',
    titleEn: 'Olympic Lifting & Power Specialist',
    titleVi: 'Chuyên Gia Cử Tạ Olympic & Bùng Nổ',
    credentials: ['USAW-L2', 'Ex-National Lifter', 'FMS Level 2'],
    experienceYears: 10,
    languages: ['VI', 'EN'],
    hourlyRateVnd: 1300000,
    goalWeights: { hypertrophy: 94, lean_recomp: 88, fat_loss: 79, endurance: 74 },
    disciplines: ['strength_barbell'],
    windows: ['morning', 'midday'],
    signatureEn: 'Explosive force production, squat/deadlift mastery & athletic power',
    signatureVi: 'Phát lực bùng nổ, chuẩn hóa Squat/Deadlift & sức mạnh vận động viên',
    accentHue: '#a3e635',
  },
  {
    id: 'coach-hana-tran',
    name: 'Hana Tran',
    initials: 'HT',
    titleEn: 'Recovery & Longevity Physiologist',
    titleVi: 'Chuyên Gia Phục Hồi & Trường Thọ',
    credentials: ['MSc Sports Physio', 'Oxygen Advantage', 'Contrast Protocol'],
    experienceYears: 7,
    languages: ['VI', 'EN'],
    hourlyRateVnd: 1250000,
    goalWeights: { endurance: 91, lean_recomp: 86, fat_loss: 80, hypertrophy: 76 },
    disciplines: ['cryo_recovery', 'reformer_pilates'],
    windows: ['morning', 'midday', 'evening'],
    signatureEn: 'HRV nervous-system optimization, cold plunge dosing & deep sleep recovery',
    signatureVi: 'Tối ưu hệ thần kinh HRV, định lượng ngâm lạnh & phục hồi giấc ngủ sâu',
    accentHue: '#38bdf8',
  },
  {
    id: 'coach-linh-nguyen',
    name: 'Linh Nguyen',
    initials: 'LN',
    titleEn: 'Metabolic Fat-Loss & Conditioning',
    titleVi: 'Chuyên Gia Giảm Mỡ & Thể Lực Chuyển Hóa',
    credentials: ['NASM-PES', 'Kettlebell StrongFirst', 'Macro Coaching'],
    experienceYears: 6,
    languages: ['VI', 'EN'],
    hourlyRateVnd: 1150000,
    goalWeights: { fat_loss: 97, lean_recomp: 91, endurance: 88, hypertrophy: 77 },
    disciplines: ['hiit_lab', 'strength_barbell'],
    windows: ['midday', 'evening'],
    signatureEn: 'Sustainable 12-week fat-loss transformations & kettlebell conditioning',
    signatureVi: 'Chuyển đổi giảm mỡ bền vững 12 tuần & thể lực tạ ấm chuyên sâu',
    accentHue: '#a3e635',
  },
];

export function filterClasses(
  sessions: ClassSession[],
  discipline: DisciplineId | 'all',
  day: DayOfWeek | 'all'
): ClassSession[] {
  return sessions.filter((s) => {
    const matchDiscipline = discipline === 'all' || s.discipline === discipline;
    const matchDay = day === 'all' || s.day === day;
    return matchDiscipline && matchDay;
  });
}

export function getClassAvailability(
  session: ClassSession,
  state: TimetableBookingState
): SlotAvailability {
  const seatOffset = state.seatDelta[session.id] ?? 0;
  const waitlistOffset = state.waitlistDelta[session.id] ?? 0;
  const booked = Math.min(session.capacity, Math.max(0, session.initialBooked + seatOffset));
  const remaining = Math.max(0, session.capacity - booked);
  const waitlistCount = Math.max(0, session.initialWaitlist + waitlistOffset);
  const occupancyPct = Math.round((booked / session.capacity) * 100);
  return {
    capacity: session.capacity,
    booked,
    remaining,
    isFull: remaining === 0,
    waitlistCount,
    occupancyPct,
    userBooking: state.bookings[session.id] ?? null,
  };
}

/**
 * Books a confirmed spot if capacity permits, or automatically joins the waitlist when full.
 */
export function bookClassSlot(
  session: ClassSession,
  state: TimetableBookingState,
  nowIso: string = new Date().toISOString()
): BookActionResult {
  if (state.bookings[session.id]) {
    return { nextState: state, outcome: 'already_booked' };
  }

  const avail = getClassAvailability(session, state);

  if (!avail.isFull) {
    const nextState: TimetableBookingState = {
      bookings: {
        ...state.bookings,
        [session.id]: {
          classId: session.id,
          status: 'confirmed',
          bookedAt: nowIso,
        },
      },
      seatDelta: {
        ...state.seatDelta,
        [session.id]: (state.seatDelta[session.id] ?? 0) + 1,
      },
      waitlistDelta: { ...state.waitlistDelta },
    };
    return { nextState, outcome: 'confirmed' };
  }

  const nextWaitlistPosition = avail.waitlistCount + 1;
  const nextState: TimetableBookingState = {
    bookings: {
      ...state.bookings,
      [session.id]: {
        classId: session.id,
        status: 'waitlist',
        waitlistPosition: nextWaitlistPosition,
        bookedAt: nowIso,
      },
    },
    seatDelta: { ...state.seatDelta },
    waitlistDelta: {
      ...state.waitlistDelta,
      [session.id]: (state.waitlistDelta[session.id] ?? 0) + 1,
    },
  };
  return {
    nextState,
    outcome: 'waitlist',
    waitlistPosition: nextWaitlistPosition,
  };
}

/**
 * Cancels the user's confirmed seat or waitlist entry cleanly.
 */
export function cancelClassSlot(
  session: ClassSession,
  state: TimetableBookingState
): { nextState: TimetableBookingState; removedStatus: 'confirmed' | 'waitlist' | 'none' } {
  const existing = state.bookings[session.id];
  if (!existing) {
    return { nextState: state, removedStatus: 'none' };
  }

  const nextBookings = { ...state.bookings };
  delete nextBookings[session.id];

  const nextSeatDelta = { ...state.seatDelta };
  const nextWaitlistDelta = { ...state.waitlistDelta };

  if (existing.status === 'confirmed') {
    nextSeatDelta[session.id] = (nextSeatDelta[session.id] ?? 0) - 1;
  } else {
    nextWaitlistDelta[session.id] = (nextWaitlistDelta[session.id] ?? 0) - 1;
  }

  return {
    nextState: {
      bookings: nextBookings,
      seatDelta: nextSeatDelta,
      waitlistDelta: nextWaitlistDelta,
    },
    removedStatus: existing.status,
  };
}

/**
 * Ranks Personal Trainers dynamically against user's metabolic goal, preferred discipline, and window.
 */
export function matchTrainers(
  criteria: TrainerMatchCriteria,
  trainers: TrainerProfile[] = VANGUARD_TRAINERS
): MatchedTrainer[] {
  return trainers
    .map((trainer) => {
      const goalBase = trainer.goalWeights[criteria.goal];
      const disciplineMatch =
        criteria.preferredDiscipline === 'all' ||
        trainer.disciplines.includes(criteria.preferredDiscipline);
      const windowMatch = trainer.windows.includes(criteria.window);

      let score = goalBase * 0.72;
      score += disciplineMatch ? 18 : 5;
      score += windowMatch ? 10 : 3;

      const matchScore = Math.min(99, Math.max(58, Math.round(score)));
      const matchedReasonsEn: string[] = [];
      const matchedReasonsVi: string[] = [];

      if (goalBase >= 90) {
        matchedReasonsEn.push('Primary Goal Specialist');
        matchedReasonsVi.push('Chuyên Gia Đúng Mục Tiêu');
      }
      if (criteria.preferredDiscipline !== 'all' && disciplineMatch) {
        matchedReasonsEn.push('Discipline Lead');
        matchedReasonsVi.push('Đúng Bộ Môn Ưu Tiên');
      }
      if (windowMatch) {
        matchedReasonsEn.push('Schedule Aligned');
        matchedReasonsVi.push('Khớp Khung Giờ Tập');
      }
      if (matchedReasonsEn.length === 0) {
        matchedReasonsEn.push('Cross-Disciplinary Support');
        matchedReasonsVi.push('Hỗ Trợ Đa Bộ Môn');
      }

      return {
        ...trainer,
        matchScore,
        matchedReasonsEn,
        matchedReasonsVi,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Exports a single Vanguard class session into a standards-compliant RFC 5545 .ics calendar file.
 */
export function exportClassToIcs(
  session: ClassSession,
  clubAddress: string = 'Vanguard Bio-Performance Club, 88 Dong Khoi, District 1, HCMC'
): string {
  const dayOffsetMap: Record<DayOfWeek, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 0,
  };

  // Compute upcoming occurrence date deterministically from reference date
  const now = new Date();
  const targetDow = dayOffsetMap[session.day];
  const diff = (targetDow - now.getDay() + 7) % 7 || 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const [hh, mm] = session.startTime.split(':').map(Number);
  start.setHours(hh, mm, 0, 0);
  const end = new Date(start.getTime() + session.durationMin * 60000);

  const fmt = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vanguard Bio-Performance Club//Timetable//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@vanguard-fitness.tvt`,
    `DTSTAMP:${fmt(now)}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:VANGUARD · ${session.titleEn} (${session.coachName})`,
    `LOCATION:${session.studioZone} - ${clubAddress}`,
    `DESCRIPTION:Bio-Performance session (${session.durationMin} min, Est. ${session.caloriesEst} kcal). Arrive 10 minutes early for biometric check-in.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
