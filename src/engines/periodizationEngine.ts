export type PeriodizationGoal =
  | 'hypertrophy_volume'
  | 'powerlifting_peaking'
  | 'hyrox_hybrid'
  | 'executive_recomp';

export type TrainingDaysPerWeek = 3 | 4 | 5 | 6;

export type ExperienceLevel = 'novice' | 'intermediate' | 'advanced';

export type MesocyclePhase =
  | 'accumulation'
  | 'intensification'
  | 'peak_deload';

export type MuscleGroupId =
  | 'quads'
  | 'posterior_chain'
  | 'push'
  | 'pull'
  | 'core'
  | 'conditioning';

export type LiftAnchor = 'squat' | 'bench' | 'deadlift' | null;

export interface OneRepMaxProfile {
  squatKg: number;
  benchKg: number;
  deadliftKg: number;
}

export interface PeriodizationInput {
  goal: PeriodizationGoal;
  daysPerWeek: TrainingDaysPerWeek;
  experience: ExperienceLevel;
  oneRepMax: OneRepMaxProfile;
}

export interface WeeklyBlockMetrics {
  week: number;
  phase: MesocyclePhase;
  phaseLabelEn: string;
  phaseLabelVi: string;
  isDeload: boolean;
  effectiveSets: number;
  volumeChangeFromPeakPct: number;
  relativeIntensityPct: number;
  targetRpe: number;
  sessionLoadAu: number;
  chronicLoadAu: number;
  acwr: number;
  acwrStatus: 'optimal' | 'deload' | 'caution';
  prescribedLoadsKg: OneRepMaxProfile;
}

export interface SplitExercise {
  id: string;
  nameEn: string;
  nameVi: string;
  muscleGroup: MuscleGroupId;
  liftAnchor: LiftAnchor;
  sets: number;
  reps: string;
  intensityPct1Rm: number | null;
  targetLoadKg: number | null;
  rpe: number;
  restSec: number;
}

export interface SplitDayPlan {
  dayIndex: number;
  dayCode: string;
  focusEn: string;
  focusVi: string;
  primaryModality: 'strength' | 'hypertrophy' | 'conditioning' | 'hybrid';
  totalSets: number;
  estDurationMin: number;
  exercises: SplitExercise[];
}

export interface MesocycleSummary {
  phase: MesocyclePhase;
  weeksLabel: string;
  titleEn: string;
  titleVi: string;
  avgEffectiveSets: number;
  peakIntensityPct: number;
  deloadWeek: number;
  objectiveEn: string;
  objectiveVi: string;
}

export interface PeriodizationPlanResult {
  input: PeriodizationInput;
  inspectedWeek: number;
  splitLabelEn: string;
  splitLabelVi: string;
  mesocycles: MesocycleSummary[];
  weeks: WeeklyBlockMetrics[];
  peakAcwr: number;
  peakWeeklySets: number;
  peakIntensityPct: number;
  deloadDropPcts: number[];
  muscleGroupWeeklySets: Record<MuscleGroupId, number>;
  pushToPullRatio: number;
  weeklySplit: SplitDayPlan[];
}

export const MAX_SAFE_ACWR = 1.35;

export const DEFAULT_1RM_BY_EXPERIENCE: Record<ExperienceLevel, OneRepMaxProfile> = {
  novice: { squatKg: 95, benchKg: 67.5, deadliftKg: 115 },
  intermediate: { squatKg: 140, benchKg: 100, deadliftKg: 175 },
  advanced: { squatKg: 185, benchKg: 132.5, deadliftKg: 225 },
};

const DAYS_BASE_SETS: Record<TrainingDaysPerWeek, number> = {
  3: 42,
  4: 52,
  5: 62,
  6: 72,
};

const EXPERIENCE_VOLUME_MULT: Record<ExperienceLevel, number> = {
  novice: 0.84,
  intermediate: 1.0,
  advanced: 1.14,
};

const GOAL_VOLUME_MULT: Record<PeriodizationGoal, number> = {
  hypertrophy_volume: 1.15,
  powerlifting_peaking: 0.88,
  hyrox_hybrid: 1.04,
  executive_recomp: 0.96,
};

const GOAL_VOLUME_WAVE: Record<PeriodizationGoal, readonly number[]> = {
  // Indices 0..11 correspond to Weeks 1..12; W4/W8/W12 are computed directly as 60% of W3/W7/W11
  hypertrophy_volume: [1.0, 1.07, 1.14, 0.6, 1.04, 1.11, 1.18, 0.6, 1.02, 1.08, 1.14, 0.6],
  powerlifting_peaking: [1.0, 1.06, 1.11, 0.6, 0.98, 1.03, 1.07, 0.6, 0.92, 0.94, 0.9, 0.6],
  hyrox_hybrid: [1.0, 1.06, 1.13, 0.6, 1.03, 1.09, 1.15, 0.6, 1.0, 1.06, 1.1, 0.6],
  executive_recomp: [1.0, 1.06, 1.12, 0.6, 1.02, 1.08, 1.13, 0.6, 0.98, 1.04, 1.08, 0.6],
};

const GOAL_INTENSITY_WAVE: Record<PeriodizationGoal, readonly number[]> = {
  hypertrophy_volume: [68, 70, 73, 64, 72, 75, 78, 66, 76, 79, 82, 68],
  powerlifting_peaking: [74, 77, 80, 70, 81, 84, 87, 74, 88, 91, 94, 76],
  hyrox_hybrid: [66, 69, 72, 62, 71, 74, 77, 65, 75, 78, 81, 67],
  executive_recomp: [70, 72, 75, 65, 74, 77, 80, 68, 78, 81, 84, 70],
};

const GOAL_RPE_WAVE: Record<PeriodizationGoal, readonly number[]> = {
  hypertrophy_volume: [7.0, 7.5, 8.0, 6.5, 7.5, 8.0, 8.5, 6.5, 8.0, 8.5, 9.0, 6.5],
  powerlifting_peaking: [7.0, 7.5, 8.0, 6.5, 7.5, 8.0, 8.5, 6.5, 8.5, 9.0, 9.5, 6.5],
  hyrox_hybrid: [7.0, 7.5, 8.0, 6.5, 7.5, 8.0, 8.5, 6.5, 8.0, 8.5, 9.0, 6.5],
  executive_recomp: [7.0, 7.5, 8.0, 6.5, 7.5, 8.0, 8.5, 6.5, 8.0, 8.5, 8.5, 6.5],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Epley 1RM Estimator: 1RM = weight * (1 + reps / 30).
 */
export function estimate1RmEpley(weightKg: number, reps: number): number {
  const safeWeight = Math.max(0, weightKg);
  const safeReps = clamp(Math.round(reps), 1, 20);
  if (safeReps <= 1) return round1(safeWeight);
  return round1(safeWeight * (1 + safeReps / 30));
}

/**
 * Brzycki 1RM Estimator: 1RM = weight * (36 / (37 - reps)).
 */
export function estimate1RmBrzycki(weightKg: number, reps: number): number {
  const safeWeight = Math.max(0, weightKg);
  const safeReps = clamp(Math.round(reps), 1, 15);
  if (safeReps <= 1) return round1(safeWeight);
  return round1(safeWeight * (36 / (37 - safeReps)));
}

/**
 * Computes plate-rounded working barbell weight for a target %1RM.
 */
export function computeWorkingLoadKg(
  oneRmKg: number,
  intensityPct: number,
  incrementKg: number = 2.5
): number {
  const safeOneRm = Math.max(20, oneRmKg);
  const safePct = clamp(intensityPct, 40, 100);
  const raw = safeOneRm * (safePct / 100);
  return Math.max(incrementKg, Math.round(raw / incrementKg) * incrementKg);
}

function computeSessionLoadAu(
  effectiveSets: number,
  relativeIntensityPct: number,
  targetRpe: number
): number {
  return Math.round(effectiveSets * (relativeIntensityPct / 100) * targetRpe * 10);
}

function getPhaseForWeek(week: number): {
  phase: MesocyclePhase;
  labelEn: string;
  labelVi: string;
} {
  if (week <= 4) {
    return {
      phase: 'accumulation',
      labelEn: 'Accumulation',
      labelVi: 'Tích Lũy Khối Lượng',
    };
  }
  if (week <= 8) {
    return {
      phase: 'intensification',
      labelEn: 'Intensification',
      labelVi: 'Tăng Tiến Cường Độ',
    };
  }
  return {
    phase: 'peak_deload',
    labelEn: 'Peak & Deload',
    labelVi: 'Đạt Đỉnh & Xả Tải',
  };
}

interface ExerciseTemplate {
  id: string;
  nameEn: string;
  nameVi: string;
  muscleGroup: MuscleGroupId;
  liftAnchor: LiftAnchor;
  baseSets: number;
  intensityDelta: number;
  restSec: number;
}

interface DayTemplate {
  dayCode: string;
  focusEn: string;
  focusVi: string;
  primaryModality: 'strength' | 'hypertrophy' | 'conditioning' | 'hybrid';
  exercises: ExerciseTemplate[];
}

function getSplitTemplates(
  daysPerWeek: TrainingDaysPerWeek,
  goal: PeriodizationGoal
): { labelEn: string; labelVi: string; days: DayTemplate[] } {
  const isHyrox = goal === 'hyrox_hybrid';
  const isPower = goal === 'powerlifting_peaking';

  if (daysPerWeek === 3) {
    return {
      labelEn: '3-Day Full-Body Undulating Split',
      labelVi: 'Lịch 3 Buổi Toàn Thân Sóng Cường Độ',
      days: [
        {
          dayCode: 'MON',
          focusEn: 'Full Body A · Squat & Horizontal Push/Pull',
          focusVi: 'Toàn Thân A · Squat & Đẩy/Kéo Ngang',
          primaryModality: isPower ? 'strength' : 'hybrid',
          exercises: [
            { id: 'd1-sq', nameEn: 'Competition Back Squat', nameVi: 'Back Squat Chuẩn Thi Đấu', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'd1-bp', nameEn: 'Barbell Bench Press', nameVi: 'Đẩy Ngực Thanh Đòn', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: -2, restSec: 150 },
            { id: 'd1-row', nameEn: 'Chest-Supported Seal Row', nameVi: 'Kéo Lưng Nằm Ghế Dốc', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -6, restSec: 120 },
            { id: 'd1-core', nameEn: isHyrox ? 'SkiErg 500m Threshold Intervals' : 'Hanging Toes-to-Bar Core', nameVi: isHyrox ? 'Chạy Máy SkiErg Ngưỡng 500m' : 'Treo Xà Nâng Chân Cơ Lõi', muscleGroup: isHyrox ? 'conditioning' : 'core', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
          ],
        },
        {
          dayCode: 'WED',
          focusEn: 'Full Body B · Deadlift & Vertical Press/Pull',
          focusVi: 'Toàn Thân B · Deadlift & Đẩy/Kéo Dọc',
          primaryModality: 'strength',
          exercises: [
            { id: 'd2-dl', nameEn: 'Conventional / Trap-Bar Deadlift', nameVi: 'Deadlift Chuẩn Kỹ Thuật', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'd2-ohp', nameEn: 'Standing Overhead Barbell Press', nameVi: 'Đẩy Vai Đứng Thanh Đòn', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 3, intensityDelta: -18, restSec: 120 },
            { id: 'd2-pull', nameEn: 'Weighted Neutral-Grip Pull-Up', nameVi: 'Kéo Xà Đơn Gắn Tạ', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -5, restSec: 120 },
            { id: 'd2-cond', nameEn: 'Zone 4 Sled Push & Row Erg', nameVi: 'Đẩy Xe Trượt & Máy Chèo Zone 4', muscleGroup: 'conditioning', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
          ],
        },
        {
          dayCode: 'FRI',
          focusEn: 'Full Body C · Unilateral Legs & Hypertrophy',
          focusVi: 'Toàn Thân C · Chân Đơn Trục & Tăng Cơ',
          primaryModality: 'hypertrophy',
          exercises: [
            { id: 'd3-bss', nameEn: 'Rear-Foot Elevated Split Squat', nameVi: 'Bulgarian Split Squat', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 3, intensityDelta: -24, restSec: 120 },
            { id: 'd3-rdl', nameEn: 'Romanian Barbell Deadlift', nameVi: 'Romanian Deadlift Chuỗi Sau', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 3, intensityDelta: -18, restSec: 120 },
            { id: 'd3-inc', nameEn: 'Incline Dumbbell Press', nameVi: 'Đẩy Ngực Dốc Tạ Đơn', muscleGroup: 'push', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 90 },
            { id: 'd3-cab', nameEn: 'Single-Arm Cable Lat Row', nameVi: 'Kéo Xô Cáp Một Tay', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 90 },
          ],
        },
      ],
    };
  }

  if (daysPerWeek === 4) {
    return {
      labelEn: '4-Day Upper / Lower Performance Split',
      labelVi: 'Lịch 4 Buổi Thân Trên / Thân Dưới Chuẩn Khoa Học',
      days: [
        {
          dayCode: 'MON',
          focusEn: 'Lower A · Squat Force & Quad Drive',
          focusVi: 'Thân Dưới A · Sức Mạnh Squat & Đùi Trước',
          primaryModality: 'strength',
          exercises: [
            { id: 'u4-1', nameEn: 'Competition Back Squat', nameVi: 'Back Squat Chuẩn Thi Đấu', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'u4-2', nameEn: 'Romanian Barbell Deadlift', nameVi: 'Romanian Deadlift', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 3, intensityDelta: -18, restSec: 120 },
            { id: 'u4-3', nameEn: 'Hack Squat / Pendulum Squat', nameVi: 'Đạp Đùi Hack Squat', muscleGroup: 'quads', liftAnchor: null, baseSets: 3, intensityDelta: -8, restSec: 105 },
            { id: 'u4-4', nameEn: 'Weighted Ab-Wheel & Pallof Press', nameVi: 'Con Lăn Cơ Lõi & Pallof Press', muscleGroup: 'core', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
          ],
        },
        {
          dayCode: 'TUE',
          focusEn: 'Upper A · Bench Press & Vertical Pull',
          focusVi: 'Thân Trên A · Đẩy Ngực & Kéo Xà',
          primaryModality: 'strength',
          exercises: [
            { id: 'u4-5', nameEn: 'Paused Barbell Bench Press', nameVi: 'Đẩy Ngực Thanh Đòn Dừng Đáy', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: 0, restSec: 165 },
            { id: 'u4-6', nameEn: 'Weighted Pull-Up / Lat Pulldown', nameVi: 'Kéo Xà Đơn Gắn Tạ', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -6, restSec: 120 },
            { id: 'u4-7', nameEn: 'Seated Dumbbell Shoulder Press', nameVi: 'Đẩy Vai Tạ Đơn Ngồi', muscleGroup: 'push', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
            { id: 'u4-8', nameEn: 'Chest-Supported T-Bar Row', nameVi: 'Kéo Lưng T-Bar Tựa Ngực', muscleGroup: 'pull', liftAnchor: null, baseSets: 3, intensityDelta: -8, restSec: 90 },
          ],
        },
        {
          dayCode: 'THU',
          focusEn: 'Lower B · Deadlift & Posterior Chain',
          focusVi: 'Thân Dưới B · Deadlift & Chuỗi Cơ Sau',
          primaryModality: isHyrox ? 'hybrid' : 'strength',
          exercises: [
            { id: 'u4-9', nameEn: 'Competition Deadlift', nameVi: 'Deadlift Chuẩn Thi Đấu', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'u4-10', nameEn: 'Tempo Front Squat / Split Squat', nameVi: 'Front Squat Kiểm Soát Nhịp', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 3, intensityDelta: -16, restSec: 135 },
            { id: 'u4-11', nameEn: 'Seated Hamstring Curl', nameVi: 'Cuốn Đùi Sau Trên Máy', muscleGroup: 'posterior_chain', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
            { id: 'u4-12', nameEn: isHyrox ? 'HYROX 1km Run + Sled Pull' : 'Anaerobic Concept2 Erg Intervals', nameVi: isHyrox ? 'Chạy 1km HYROX + Kéo Xe Trượt' : 'Chèo Máy Concept2 Ngưỡng Kỵ Khí', muscleGroup: 'conditioning', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
          ],
        },
        {
          dayCode: 'FRI',
          focusEn: 'Upper B · Hypertrophy Volume & Delts',
          focusVi: 'Thân Trên B · Tăng Cơ Khối Lượng & Vai',
          primaryModality: 'hypertrophy',
          exercises: [
            { id: 'u4-13', nameEn: 'Incline Barbell / DB Bench', nameVi: 'Đẩy Ngực Dốc Trên', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: -12, restSec: 120 },
            { id: 'u4-14', nameEn: 'Pendlay Barbell Row', nameVi: 'Kéo Lưng Pendlay Thanh Đòn', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 105 },
            { id: 'u4-15', nameEn: 'Cable Lateral Raise + Triceps Press', nameVi: 'Bay Vai Cáp & Tay Sau', muscleGroup: 'push', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
            { id: 'u4-16', nameEn: 'Face Pulls & Incline Hammer Curl', nameVi: 'Kéo Cáp Vai Sau & Tay Trước', muscleGroup: 'pull', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
          ],
        },
      ],
    };
  }

  if (daysPerWeek === 5) {
    return {
      labelEn: '5-Day Upper / Lower / Hybrid Performance Split',
      labelVi: 'Lịch 5 Buổi Thân Trên / Thân Dưới / Hybrid',
      days: [
        {
          dayCode: 'MON',
          focusEn: 'Lower Force · Competition Squat Focus',
          focusVi: 'Thân Dưới Lực · Trọng Tâm Back Squat',
          primaryModality: 'strength',
          exercises: [
            { id: 'u5-1', nameEn: 'Competition Back Squat', nameVi: 'Back Squat Chuẩn Thi Đấu', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'u5-2', nameEn: 'Barbell Hip Thrust / RDL', nameVi: 'Romanian Deadlift Chuỗi Sau', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 3, intensityDelta: -18, restSec: 120 },
            { id: 'u5-3', nameEn: 'Walking Dumbbell Lunges', nameVi: 'Bước Chùng Tạ Đơn', muscleGroup: 'quads', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
            { id: 'u5-4', nameEn: 'Weighted Hanging Leg Raise', nameVi: 'Treo Xà Nâng Chân Gắn Tạ', muscleGroup: 'core', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
          ],
        },
        {
          dayCode: 'TUE',
          focusEn: 'Upper Force · Bench Press & Heavy Row',
          focusVi: 'Thân Trên Lực · Đẩy Ngực & Kéo Lưng Nặng',
          primaryModality: 'strength',
          exercises: [
            { id: 'u5-5', nameEn: 'Barbell Bench Press', nameVi: 'Đẩy Ngực Thanh Đòn', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: 0, restSec: 165 },
            { id: 'u5-6', nameEn: 'Weighted Chest-Supported Row', nameVi: 'Kéo Lưng Tựa Ngực Nặng', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -6, restSec: 120 },
            { id: 'u5-7', nameEn: 'Weighted Dips / Close-Grip Bench', nameVi: 'Xà Kép Gắn Tạ / Đẩy Hẹp Tay', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 3, intensityDelta: -14, restSec: 105 },
            { id: 'u5-8', nameEn: 'Neutral-Grip Lat Pulldown', nameVi: 'Kéo Xô Tay Trung Tính', muscleGroup: 'pull', liftAnchor: null, baseSets: 3, intensityDelta: -8, restSec: 90 },
          ],
        },
        {
          dayCode: 'WED',
          focusEn: 'Hybrid Metabolic Engine · HYROX & Core',
          focusVi: 'Động Cơ Chuyển Hóa Hybrid · HYROX & Lõi',
          primaryModality: 'conditioning',
          exercises: [
            { id: 'u5-9', nameEn: 'Heavy Sled Push & Pull (4×25m)', nameVi: 'Đẩy & Kéo Xe Trượt Nặng (4×25m)', muscleGroup: 'conditioning', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 90 },
            { id: 'u5-10', nameEn: 'SkiErg + RowErg Threshold Blocks', nameVi: 'Tổ Hợp SkiErg + RowErg Ngưỡng VO2', muscleGroup: 'conditioning', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
            { id: 'u5-11', nameEn: 'Farmers Carry & Wall Balls', nameVi: 'Xách Tạ Nông Dân & Ném Bóng Wall Ball', muscleGroup: 'core', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
          ],
        },
        {
          dayCode: 'FRI',
          focusEn: 'Lower Posterior · Deadlift & Glute Power',
          focusVi: 'Thân Dưới Sau · Deadlift & Phát Lực Hông',
          primaryModality: 'strength',
          exercises: [
            { id: 'u5-12', nameEn: 'Competition Deadlift', nameVi: 'Deadlift Chuẩn Thi Đấu', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 4, intensityDelta: 0, restSec: 180 },
            { id: 'u5-13', nameEn: 'Pause Front Squat', nameVi: 'Front Squat Dừng Đáy', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 3, intensityDelta: -18, restSec: 135 },
            { id: 'u5-14', nameEn: 'Nordic Hamstring / Lying Curl', nameVi: 'Gập Đùi Sau Chuyên Sâu', muscleGroup: 'posterior_chain', liftAnchor: null, baseSets: 3, intensityDelta: -10, restSec: 90 },
          ],
        },
        {
          dayCode: 'SAT',
          focusEn: 'Upper Hypertrophy · Pull, Delts & Arms',
          focusVi: 'Thân Trên Tăng Cơ · Xô, Vai & Tay',
          primaryModality: 'hypertrophy',
          exercises: [
            { id: 'u5-15', nameEn: 'Incline Dumbbell Press', nameVi: 'Đẩy Ngực Dốc Tạ Đơn', muscleGroup: 'push', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 105 },
            { id: 'u5-16', nameEn: 'Weighted Pull-Ups', nameVi: 'Kéo Xà Đơn Gắn Tạ', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -6, restSec: 105 },
            { id: 'u5-17', nameEn: 'Cable Lateral Raise & Rear Delt Fly', nameVi: 'Bay Vai Cáp & Vai Sau', muscleGroup: 'push', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
            { id: 'u5-18', nameEn: 'Single-Arm Cable Row & Curl', nameVi: 'Kéo Xô Một Tay & Tay Trước', muscleGroup: 'pull', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
          ],
        },
      ],
    };
  }

  // 6-Day Push / Pull / Legs x 2
  return {
    labelEn: '6-Day Push / Pull / Legs Dual-Wave Split',
    labelVi: 'Lịch 6 Buổi Đẩy / Kéo / Chân Hai Sóng',
    days: [
      {
        dayCode: 'MON',
        focusEn: 'Push A · Heavy Bench & Overhead Strength',
        focusVi: 'Đẩy A · Đẩy Ngực Nặng & Vai Đứng',
        primaryModality: 'strength',
        exercises: [
          { id: 'p6-1', nameEn: 'Competition Barbell Bench Press', nameVi: 'Đẩy Ngực Thanh Đòn Thi Đấu', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: 0, restSec: 165 },
          { id: 'p6-2', nameEn: 'Standing Barbell Overhead Press', nameVi: 'Đẩy Vai Đứng Thanh Đòn', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 3, intensityDelta: -20, restSec: 120 },
          { id: 'p6-3', nameEn: 'Weighted Dips & Cable Flye', nameVi: 'Xà Kép Gắn Tạ & Ép Ngực Cáp', muscleGroup: 'push', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
        ],
      },
      {
        dayCode: 'TUE',
        focusEn: 'Pull A · Heavy Weighted Pull & Row',
        focusVi: 'Kéo A · Kéo Xà Nặng & Lưng Giữa',
        primaryModality: 'strength',
        exercises: [
          { id: 'p6-4', nameEn: 'Weighted Pull-Up', nameVi: 'Kéo Xà Đơn Gắn Tạ', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -4, restSec: 135 },
          { id: 'p6-5', nameEn: 'Pendlay Barbell Row', nameVi: 'Kéo Lưng Pendlay', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -6, restSec: 120 },
          { id: 'p6-6', nameEn: 'Rear-Delt Cable Pull & Barbell Curl', nameVi: 'Kéo Vai Sau & Cuốn Tay Trước', muscleGroup: 'pull', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
        ],
      },
      {
        dayCode: 'WED',
        focusEn: 'Legs A · Squat Primary & Quad Hypertrophy',
        focusVi: 'Chân A · Back Squat & Đùi Trước',
        primaryModality: 'strength',
        exercises: [
          { id: 'p6-7', nameEn: 'Competition Back Squat', nameVi: 'Back Squat Chuẩn Thi Đấu', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 4, intensityDelta: 0, restSec: 180 },
          { id: 'p6-8', nameEn: 'Bulgarian Split Squat', nameVi: 'Bulgarian Split Squat', muscleGroup: 'quads', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 105 },
          { id: 'p6-9', nameEn: 'Seated Leg Curl & Weighted Core', nameVi: 'Cuốn Đùi Sau & Cơ Lõi Gắn Tạ', muscleGroup: 'core', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
        ],
      },
      {
        dayCode: 'THU',
        focusEn: 'Push B · Incline Volume & Lateral Delts',
        focusVi: 'Đẩy B · Ngực Dốc Khối Lượng & Vai Giữa',
        primaryModality: 'hypertrophy',
        exercises: [
          { id: 'p6-10', nameEn: 'Incline Barbell Press', nameVi: 'Đẩy Ngực Dốc Thanh Đòn', muscleGroup: 'push', liftAnchor: 'bench', baseSets: 4, intensityDelta: -12, restSec: 120 },
          { id: 'p6-11', nameEn: 'Machine Chest Press (Slow Eccentric)', nameVi: 'Đẩy Ngực Máy Kiểm Soát Nhịp', muscleGroup: 'push', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
          { id: 'p6-12', nameEn: 'Cable Lateral Raise & Overhead Triceps', nameVi: 'Bay Vai Cáp & Tay Sau Qua Đầu', muscleGroup: 'push', liftAnchor: null, baseSets: 3, intensityDelta: -12, restSec: 75 },
        ],
      },
      {
        dayCode: 'FRI',
        focusEn: 'Pull B · Lat Width & Conditioning Finisher',
        focusVi: 'Kéo B · Độ Rộng Xô & Thể Lực Chuyển Hóa',
        primaryModality: isHyrox ? 'hybrid' : 'hypertrophy',
        exercises: [
          { id: 'p6-13', nameEn: 'Chest-Supported Seal Row', nameVi: 'Kéo Lưng Tựa Ngực', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -8, restSec: 105 },
          { id: 'p6-14', nameEn: 'Single-Arm Iliac Lat Pulldown', nameVi: 'Kéo Xô Một Tay Cáp', muscleGroup: 'pull', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
          { id: 'p6-15', nameEn: isHyrox ? 'HYROX Sled + SkiErg Conditioning' : 'Concept2 RowErg Anaerobic Threshold', nameVi: isHyrox ? 'Tổ Hợp Xe Trượt HYROX + SkiErg' : 'Chèo Concept2 Ngưỡng Kỵ Khí', muscleGroup: 'conditioning', liftAnchor: null, baseSets: 4, intensityDelta: -10, restSec: 90 },
        ],
      },
      {
        dayCode: 'SAT',
        focusEn: 'Legs B · Deadlift & Posterior Chain',
        focusVi: 'Chân B · Deadlift & Chuỗi Cơ Sau',
        primaryModality: 'strength',
        exercises: [
          { id: 'p6-16', nameEn: 'Competition Deadlift', nameVi: 'Deadlift Chuẩn Thi Đấu', muscleGroup: 'posterior_chain', liftAnchor: 'deadlift', baseSets: 4, intensityDelta: 0, restSec: 180 },
          { id: 'p6-17', nameEn: 'Front Squat / Hack Squat', nameVi: 'Front Squat / Hack Squat', muscleGroup: 'quads', liftAnchor: 'squat', baseSets: 4, intensityDelta: -18, restSec: 120 },
          { id: 'p6-18', nameEn: 'Romanian Deadlift & Standing Calf', nameVi: 'Romanian Deadlift & Bắp Chân', muscleGroup: 'posterior_chain', liftAnchor: null, baseSets: 4, intensityDelta: -12, restSec: 90 },
        ],
      },
    ],
  };
}

function repRangeForExercise(
  goal: PeriodizationGoal,
  phase: MesocyclePhase,
  isDeload: boolean,
  isPrimaryLift: boolean
): string {
  if (isDeload) return isPrimaryLift ? '4–5 (Tech)' : '8–10 (Easy)';
  if (goal === 'powerlifting_peaking') {
    if (phase === 'accumulation') return isPrimaryLift ? '5–6' : '8–10';
    if (phase === 'intensification') return isPrimaryLift ? '3–4' : '6–8';
    return isPrimaryLift ? '1–3' : '5–6';
  }
  if (goal === 'hypertrophy_volume') {
    if (phase === 'accumulation') return isPrimaryLift ? '8–10' : '10–14';
    if (phase === 'intensification') return isPrimaryLift ? '6–8' : '8–12';
    return isPrimaryLift ? '5–7' : '8–10';
  }
  if (goal === 'hyrox_hybrid') {
    if (phase === 'accumulation') return isPrimaryLift ? '6–8' : '12–15 / 500m';
    if (phase === 'intensification') return isPrimaryLift ? '5–6' : '10–12 / 750m';
    return isPrimaryLift ? '4–5' : 'Race Pace';
  }
  // executive_recomp
  if (phase === 'accumulation') return isPrimaryLift ? '6–8' : '10–12';
  if (phase === 'intensification') return isPrimaryLift ? '5–6' : '8–10';
  return isPrimaryLift ? '4–6' : '8–10';
}

/**
 * Generates a deterministic 12-week 3-mesocycle periodized training plan with:
 * - Built-in Deload Weeks (W4, W8, W12) strictly dropping volume -35% to -45%
 * - Rolling 4-week Acute:Chronic Workload Ratio (ACWR) safety guard capped <= 1.35
 * - Dynamic working barbell loads calculated from Squat/Bench/Deadlift 1RMs
 * - Balanced 3/4/5/6-day weekly workout split tailored to the inspected week
 */
export function generatePeriodizationPlan(
  rawInput: PeriodizationInput,
  inspectWeek: number = 6
): PeriodizationPlanResult {
  const safeOneRm: OneRepMaxProfile = {
    squatKg: clamp(rawInput.oneRepMax.squatKg || DEFAULT_1RM_BY_EXPERIENCE[rawInput.experience].squatKg, 30, 350),
    benchKg: clamp(rawInput.oneRepMax.benchKg || DEFAULT_1RM_BY_EXPERIENCE[rawInput.experience].benchKg, 20, 260),
    deadliftKg: clamp(rawInput.oneRepMax.deadliftKg || DEFAULT_1RM_BY_EXPERIENCE[rawInput.experience].deadliftKg, 40, 400),
  };

  const input: PeriodizationInput = {
    goal: rawInput.goal,
    daysPerWeek: rawInput.daysPerWeek,
    experience: rawInput.experience,
    oneRepMax: safeOneRm,
  };

  const inspectedWeek = clamp(Math.round(inspectWeek), 1, 12);
  const baselineSets = Math.round(
    DAYS_BASE_SETS[input.daysPerWeek] *
      EXPERIENCE_VOLUME_MULT[input.experience] *
      GOAL_VOLUME_MULT[input.goal]
  );

  const volWave = GOAL_VOLUME_WAVE[input.goal];
  const intWave = GOAL_INTENSITY_WAVE[input.goal];
  const rpeWave = GOAL_RPE_WAVE[input.goal];

  const weeks: WeeklyBlockMetrics[] = [];
  const loadHistory: number[] = [];
  const deloadDropPcts: number[] = [];

  // Habitual pre-block chronic baseline (95% of W1 load) prevents artificial W1 spike
  const w1InitialSets = Math.max(24, Math.round(baselineSets * volWave[0]));
  const baselineHabitualLoad = Math.round(
    computeSessionLoadAu(w1InitialSets, intWave[0], rpeWave[0]) * 0.95
  );

  for (let i = 0; i < 12; i++) {
    const weekNum = i + 1;
    const isDeload = weekNum === 4 || weekNum === 8 || weekNum === 12;
    const phaseInfo = getPhaseForWeek(weekNum);
    const relativeIntensityPct = intWave[i];
    const targetRpe = rpeWave[i];

    let effectiveSets: number;
    let volumeChangeFromPeakPct = 0;

    if (isDeload) {
      // Strictly drop 40% (clamped to -35%..-45% band) from preceding mesocycle peak week
      const prevPeakSets = weeks[i - 1].effectiveSets;
      effectiveSets = Math.max(12, Math.round(prevPeakSets * 0.6));
      volumeChangeFromPeakPct = round1(((effectiveSets - prevPeakSets) / prevPeakSets) * 100);
      deloadDropPcts.push(volumeChangeFromPeakPct);
    } else {
      effectiveSets = Math.max(24, Math.round(baselineSets * volWave[i]));
    }

    const computeChronicWithCandidate = (candidateLoad: number): number => {
      const windowLoads: number[] = [];
      for (let back = 3; back >= 1; back--) {
        const idx = i - back;
        windowLoads.push(idx >= 0 ? loadHistory[idx] : baselineHabitualLoad);
      }
      windowLoads.push(candidateLoad);
      return windowLoads.reduce((acc, v) => acc + v, 0) / 4;
    };

    let sessionLoadAu = computeSessionLoadAu(effectiveSets, relativeIntensityPct, targetRpe);
    let chronicLoadAu = computeChronicWithCandidate(sessionLoadAu);
    let acwr = round2(sessionLoadAu / Math.max(1, chronicLoadAu));

    // Automatic ACWR Overload Safety Guard: regulate non-deload volume so ACWR NEVER exceeds 1.35
    if (!isDeload) {
      while (acwr > MAX_SAFE_ACWR && effectiveSets > 18) {
        effectiveSets -= 1;
        sessionLoadAu = computeSessionLoadAu(effectiveSets, relativeIntensityPct, targetRpe);
        chronicLoadAu = computeChronicWithCandidate(sessionLoadAu);
        acwr = round2(sessionLoadAu / Math.max(1, chronicLoadAu));
      }
      if (i > 0 && !weeks[i - 1].isDeload) {
        volumeChangeFromPeakPct = round1(
          ((effectiveSets - weeks[i - 1].effectiveSets) / weeks[i - 1].effectiveSets) * 100
        );
      }
    }

    loadHistory.push(sessionLoadAu);

    const acwrStatus: WeeklyBlockMetrics['acwrStatus'] = isDeload
      ? 'deload'
      : acwr > 1.3
        ? 'caution'
        : 'optimal';

    weeks.push({
      week: weekNum,
      phase: phaseInfo.phase,
      phaseLabelEn: phaseInfo.labelEn,
      phaseLabelVi: phaseInfo.labelVi,
      isDeload,
      effectiveSets,
      volumeChangeFromPeakPct,
      relativeIntensityPct,
      targetRpe,
      sessionLoadAu,
      chronicLoadAu: Math.round(chronicLoadAu),
      acwr,
      acwrStatus,
      prescribedLoadsKg: {
        squatKg: computeWorkingLoadKg(safeOneRm.squatKg, relativeIntensityPct),
        benchKg: computeWorkingLoadKg(safeOneRm.benchKg, relativeIntensityPct),
        deadliftKg: computeWorkingLoadKg(safeOneRm.deadliftKg, relativeIntensityPct),
      },
    });
  }

  // Build 3 Mesocycle Summaries
  const buildMesoSummary = (
    phase: MesocyclePhase,
    startIdx: number,
    endIdx: number,
    weeksLabel: string,
    titleEn: string,
    titleVi: string,
    objectiveEn: string,
    objectiveVi: string
  ): MesocycleSummary => {
    const slice = weeks.slice(startIdx, endIdx + 1);
    const nonDeload = slice.filter((w) => !w.isDeload);
    const avgEffectiveSets = Math.round(
      nonDeload.reduce((s, w) => s + w.effectiveSets, 0) / nonDeload.length
    );
    const peakIntensityPct = Math.max(...slice.map((w) => w.relativeIntensityPct));
    return {
      phase,
      weeksLabel,
      titleEn,
      titleVi,
      avgEffectiveSets,
      peakIntensityPct,
      deloadWeek: endIdx + 1,
      objectiveEn,
      objectiveVi,
    };
  };

  const mesocycles: MesocycleSummary[] = [
    buildMesoSummary(
      'accumulation',
      0,
      3,
      'W1–W4',
      'Mesocycle 1 · Accumulation',
      'Chu Kỳ 1 · Tích Lũy Nền',
      'Expand hypertrophy work capacity, motor control & aerobic/metabolic base before W4 deload.',
      'Mở rộng sức chứa khối lượng, chuẩn hóa kỹ thuật và nền tảng chuyển hóa trước tuần xả tải W4.'
    ),
    buildMesoSummary(
      'intensification',
      4,
      7,
      'W5–W8',
      'Mesocycle 2 · Intensification',
      'Chu Kỳ 2 · Tăng Tiến Cường Độ',
      'Escalate mechanical tension (%1RM) while keeping rolling ACWR strictly inside 0.80–1.35.',
      'Đẩy cao lực căng cơ học (%1RM) đồng thời kiểm soát tỷ lệ ACWR an toàn dưới 1.35.'
    ),
    buildMesoSummary(
      'peak_deload',
      8,
      11,
      'W9–W12',
      'Mesocycle 3 · Peak & Taper',
      'Chu Kỳ 3 · Đạt Đỉnh & Xả Tải',
      'Express top-end neural force & conditioning in W10–W11 followed by W12 supercompensation deload.',
      'Bùng nổ sức mạnh thần kinh & thể lực ở W10–W11 và xả tải siêu bù đắp ở W12.'
    ),
  ];

  // Build weekly day-by-day exercise split dynamically scaled to inspectedWeek
  const activeWeek = weeks[inspectedWeek - 1];
  const templateBundle = getSplitTemplates(input.daysPerWeek, input.goal);
  const rawTemplateTotalSets = templateBundle.days.reduce(
    (sum, day) => sum + day.exercises.reduce((dSum, ex) => dSum + ex.baseSets, 0),
    0
  );
  const setScale = activeWeek.effectiveSets / Math.max(1, rawTemplateTotalSets);

  const muscleGroupWeeklySets: Record<MuscleGroupId, number> = {
    quads: 0,
    posterior_chain: 0,
    push: 0,
    pull: 0,
    core: 0,
    conditioning: 0,
  };

  const weeklySplit: SplitDayPlan[] = templateBundle.days.map((dayTpl, idx) => {
    const exercises: SplitExercise[] = dayTpl.exercises.map((exTpl) => {
      const scaledSets = clamp(
        Math.round(exTpl.baseSets * setScale),
        activeWeek.isDeload ? 2 : 2,
        7
      );
      const isPrimaryLift = exTpl.liftAnchor !== null && exTpl.intensityDelta === 0;
      const exIntensityPct =
        exTpl.liftAnchor !== null
          ? clamp(activeWeek.relativeIntensityPct + exTpl.intensityDelta, 50, 96)
          : null;

      let targetLoadKg: number | null = null;
      if (exTpl.liftAnchor && exIntensityPct !== null) {
        const anchor1Rm =
          exTpl.liftAnchor === 'squat'
            ? safeOneRm.squatKg
            : exTpl.liftAnchor === 'bench'
              ? safeOneRm.benchKg
              : safeOneRm.deadliftKg;
        targetLoadKg = computeWorkingLoadKg(anchor1Rm, exIntensityPct);
      }

      muscleGroupWeeklySets[exTpl.muscleGroup] += scaledSets;

      return {
        id: exTpl.id,
        nameEn: exTpl.nameEn,
        nameVi: exTpl.nameVi,
        muscleGroup: exTpl.muscleGroup,
        liftAnchor: exTpl.liftAnchor,
        sets: scaledSets,
        reps: repRangeForExercise(input.goal, activeWeek.phase, activeWeek.isDeload, isPrimaryLift),
        intensityPct1Rm: exIntensityPct,
        targetLoadKg,
        rpe: activeWeek.isDeload ? 6.0 : clamp(round1(activeWeek.targetRpe - (isPrimaryLift ? 0 : 0.5)), 6.0, 9.5),
        restSec: activeWeek.isDeload ? Math.max(60, exTpl.restSec - 30) : exTpl.restSec,
      };
    });

    const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
    const estDurationMin = Math.round(12 + totalSets * 3.1);

    return {
      dayIndex: idx + 1,
      dayCode: dayTpl.dayCode,
      focusEn: dayTpl.focusEn,
      focusVi: dayTpl.focusVi,
      primaryModality: dayTpl.primaryModality,
      totalSets,
      estDurationMin,
      exercises,
    };
  });

  const pushToPullRatio = round2(
    muscleGroupWeeklySets.push / Math.max(1, muscleGroupWeeklySets.pull)
  );

  return {
    input,
    inspectedWeek,
    splitLabelEn: templateBundle.labelEn,
    splitLabelVi: templateBundle.labelVi,
    mesocycles,
    weeks,
    peakAcwr: Math.max(...weeks.map((w) => w.acwr)),
    peakWeeklySets: Math.max(...weeks.map((w) => w.effectiveSets)),
    peakIntensityPct: Math.max(...weeks.map((w) => w.relativeIntensityPct)),
    deloadDropPcts,
    muscleGroupWeeklySets,
    pushToPullRatio,
    weeklySplit,
  };
}

/**
 * Exports the 12-week mesocycle block plan & weekly split as UTF-8 BOM CSV.
 */
export function exportPeriodizationCsv(plan: PeriodizationPlanResult): string {
  const lines: string[] = [
    'VANGUARD PERFORMANCE CLUB - 12-WEEK PERIODIZED MESOCYCLE PLAN',
    `Goal,${plan.input.goal},Days/Week,${plan.input.daysPerWeek},Experience,${plan.input.experience},Split,${plan.splitLabelEn}`,
    `1RM Anchors,Squat ${plan.input.oneRepMax.squatKg}kg,Bench ${plan.input.oneRepMax.benchKg}kg,Deadlift ${plan.input.oneRepMax.deadliftKg}kg,Peak ACWR,${plan.peakAcwr.toFixed(2)}`,
    '',
    'Week,Mesocycle,Deload,Effective Sets,Rel Intensity (%1RM),Target RPE,Load (AU),ACWR,Squat Load (kg),Bench Load (kg),Deadlift Load (kg)',
    ...plan.weeks.map(
      (w) =>
        `W${w.week},${w.phaseLabelEn},${w.isDeload ? 'YES' : 'NO'},${w.effectiveSets},${w.relativeIntensityPct}%,${w.targetRpe.toFixed(1)},${w.sessionLoadAu},${w.acwr.toFixed(2)},${w.prescribedLoadsKg.squatKg},${w.prescribedLoadsKg.benchKg},${w.prescribedLoadsKg.deadliftKg}`
    ),
    '',
    `WEEKLY SPLIT BREAKDOWN (WEEK ${plan.inspectedWeek})`,
    'Day,Focus,Exercise,Muscle Group,Sets,Reps,%1RM,Target Load (kg),RPE,Rest (s)',
    ...plan.weeklySplit.flatMap((day) =>
      day.exercises.map(
        (ex) =>
          `Day ${day.dayIndex} (${day.dayCode}),"${day.focusEn}","${ex.nameEn}",${ex.muscleGroup},${ex.sets},"${ex.reps}",${ex.intensityPct1Rm ? `${ex.intensityPct1Rm}%` : 'RPE-Guided'},${ex.targetLoadKg ? `${ex.targetLoadKg} kg` : 'Auto'},${ex.rpe.toFixed(1)},${ex.restSec}`
      )
    ),
  ];

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Exports the 12-week mesocycle block plan & weekly split as UTF-8 BOM Markdown.
 */
export function exportPeriodizationMarkdown(plan: PeriodizationPlanResult): string {
  const weekRows = plan.weeks
    .map(
      (w) =>
        `| W${w.week} | ${w.phaseLabelEn} | ${w.isDeload ? 'DELOAD' : 'BUILD'} | ${w.effectiveSets} | ${w.relativeIntensityPct}% | ${w.targetRpe.toFixed(1)} | ${w.acwr.toFixed(2)} | ${w.prescribedLoadsKg.squatKg} / ${w.prescribedLoadsKg.benchKg} / ${w.prescribedLoadsKg.deadliftKg} kg |`
    )
    .join('\n');

  const splitSections = plan.weeklySplit
    .map((day) => {
      const exRows = day.exercises
        .map(
          (ex) =>
            `| ${ex.nameEn} | ${ex.sets} × ${ex.reps} | ${ex.intensityPct1Rm ? `${ex.intensityPct1Rm}%` : '—'} | ${ex.targetLoadKg ? `${ex.targetLoadKg} kg` : 'RPE Auto'} | ${ex.rpe.toFixed(1)} | ${ex.restSec}s |`
        )
        .join('\n');
      return [
        `### Day ${day.dayIndex} (${day.dayCode}) — ${day.focusEn} (${day.totalSets} sets · ~${day.estDurationMin} min)`,
        '',
        '| Exercise | Sets × Reps | %1RM | Working Load | RPE | Rest |',
        '| --- | --- | --- | --- | --- | --- |',
        exRows,
      ].join('\n');
    })
    .join('\n\n');

  const content = [
    '# VANGUARD PERFORMANCE CLUB — 12-Week Periodized Mesocycle Blueprint',
    '',
    `- **Training Objective:** \`${plan.input.goal}\``,
    `- **Frequency & Split:** ${plan.input.daysPerWeek} Days/Week (${plan.splitLabelEn})`,
    `- **Athlete Level:** \`${plan.input.experience}\``,
    `- **1RM Anchors:** Squat ${plan.input.oneRepMax.squatKg} kg · Bench ${plan.input.oneRepMax.benchKg} kg · Deadlift ${plan.input.oneRepMax.deadliftKg} kg`,
    `- **Peak ACWR Safety Check:** ${plan.peakAcwr.toFixed(2)} (Capped <= ${MAX_SAFE_ACWR.toFixed(2)})`,
    `- **Built-In Deload Drops (W4 / W8 / W12):** ${plan.deloadDropPcts.map((d) => `${d.toFixed(1)}%`).join(' · ')}`,
    '',
    '## 12-Week Volume vs Intensity Progression Matrix',
    '',
    '| Week | Mesocycle | Mode | Effective Sets | %1RM | RPE | ACWR | Squat / Bench / Deadlift Load |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    weekRows,
    '',
    `## Weekly Exercise Split Breakdown (Week ${plan.inspectedWeek} Calibration)`,
    '',
    splitSections,
    '',
    '_Engineered by Vanguard Performance Club · TVT Studio_',
  ].join('\n');

  return '\uFEFF' + content;
}
