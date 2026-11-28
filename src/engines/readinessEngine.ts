export type AthleteTier =
  | 'executive_wellness'
  | 'hybrid_competitor'
  | 'marathon_elite';

export type Vo2Rating =
  | 'Superior'
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Developing';

export type AcwrBand =
  | 'undertrained'
  | 'optimal'
  | 'caution'
  | 'high_injury_risk';

export type ReadinessTier = 'GREEN' | 'AMBER' | 'RED';

export type PrescriptionCode =
  | 'PEAK_OUTPUT'
  | 'MODIFY_AEROBIC'
  | 'RECOVER_RESTORATIVE';

export type ReadinessPresetId =
  | 'peak_race_taper'
  | 'executive_jetlag_recovery'
  | 'overreaching_red_alert';

export interface ReadinessZonesInput {
  age: number; // 18-75
  restingHr: number; // 38-90 bpm
  customMaxHr: number | null; // optional override (130-225), auto Tanaka 208 - 0.7 * age
  athleteTier: AthleteTier;
  hrvTodayMs: number; // 15-180 ms (rMSSD)
  hrvBaselineMs: number; // 20-160 ms (28-day baseline rMSSD)
  sleepHours: number; // 4.0-9.5 hrs
  acuteLoadAu: number; // 0-6000 AU (7-day acute load)
  chronicLoadAu: number; // 200-5000 AU (28-day chronic weekly avg)
  subjectiveReadiness: number; // 1-10
}

export interface KarvonenZone {
  zone: 1 | 2 | 3 | 4 | 5;
  code: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';
  nameEn: string;
  nameVi: string;
  pctHrrMin: number;
  pctHrrMax: number;
  minBpm: number;
  maxBpm: number;
  weeklyMinutes: number;
  weeklySharePct: number;
  lactateRangeMmol: string;
  fuelSystemEn: string;
  fuelSystemVi: string;
}

export interface PolarizedSplitSummary {
  totalWeeklyMinutes: number;
  lowIntensityMinutes: number; // Z1 + Z2 (80%)
  tempoMinutes: number; // Z3 (5%)
  highIntensityMinutes: number; // Z4 + Z5 (15%)
  moderateAndHighMinutes: number; // Z3 + Z4 + Z5 (20%)
  lowIntensityPct: number; // 80
  highIntensityPct: number; // 20
}

export interface LactateCurvePoint {
  pctHrr: number;
  bpm: number;
  lactateMmol: number;
  zoneCode: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';
}

export interface LactateThresholdMarker {
  label: 'LT1' | 'LT2';
  pctHrr: number;
  bpm: number;
  lactateMmol: number;
  descriptionEn: string;
  descriptionVi: string;
}

export interface TelemetryDayPoint {
  dayLabel: string; // D-6 .. Today
  hrvMs: number;
  acwr: number;
  readinessEst: number;
}

export interface DailySessionPrescription {
  tier: ReadinessTier;
  code: PrescriptionCode;
  headlineEn: string;
  headlineVi: string;
  targetZoneEn: string;
  targetZoneVi: string;
  detailEn: string;
  detailVi: string;
  volumeModifierPct: number;
}

export interface ReadinessZonesResult {
  age: number;
  restingHr: number;
  maxHr: number;
  maxHrSource: 'tanaka_auto' | 'custom_override';
  heartRateReserve: number;
  athleteTier: AthleteTier;
  vo2MaxMlKgMin: number;
  vo2Percentile: number;
  vo2Rating: Vo2Rating;
  zones: KarvonenZone[];
  polarizedSplit: PolarizedSplitSummary;
  lactateCurve: LactateCurvePoint[];
  lt1: LactateThresholdMarker;
  lt2: LactateThresholdMarker;
  hrvTodayMs: number;
  hrvBaselineMs: number;
  hrvDeltaPct: number;
  acwr: number;
  acwrBand: AcwrBand;
  acwrLabelEn: string;
  acwrLabelVi: string;
  compositeReadinessScore: number;
  readinessTier: ReadinessTier;
  prescription: DailySessionPrescription;
  telemetry7Day: TelemetryDayPoint[];
}

export interface ReadinessPreset {
  id: ReadinessPresetId;
  labelEn: string;
  labelVi: string;
  tagEn: string;
  tagVi: string;
  input: ReadinessZonesInput;
}

export const DEFAULT_READINESS_INPUT: ReadinessZonesInput = {
  age: 31,
  restingHr: 52,
  customMaxHr: null,
  athleteTier: 'hybrid_competitor',
  hrvTodayMs: 82,
  hrvBaselineMs: 76,
  sleepHours: 7.6,
  acuteLoadAu: 2150,
  chronicLoadAu: 1980,
  subjectiveReadiness: 8,
};

export const READINESS_PRESETS: ReadinessPreset[] = [
  {
    id: 'peak_race_taper',
    labelEn: 'Peak Race Taper',
    labelVi: 'Đỉnh Phong Taper',
    tagEn: 'GREEN · PEAK',
    tagVi: 'XANH · ĐỈNH',
    input: {
      age: 29,
      restingHr: 46,
      customMaxHr: null,
      athleteTier: 'marathon_elite',
      hrvTodayMs: 98,
      hrvBaselineMs: 84,
      sleepHours: 8.4,
      acuteLoadAu: 1890,
      chronicLoadAu: 2050,
      subjectiveReadiness: 9,
    },
  },
  {
    id: 'executive_jetlag_recovery',
    labelEn: 'Executive Jetlag Recovery',
    labelVi: 'Phục Hồi Jetlag Doanh Nhân',
    tagEn: 'AMBER · Z2 CAP',
    tagVi: 'VÀNG · GIỚI HẠN Z2',
    input: {
      age: 38,
      restingHr: 58,
      customMaxHr: null,
      athleteTier: 'executive_wellness',
      hrvTodayMs: 56,
      hrvBaselineMs: 66,
      sleepHours: 5.8,
      acuteLoadAu: 1920,
      chronicLoadAu: 1560,
      subjectiveReadiness: 5,
    },
  },
  {
    id: 'overreaching_red_alert',
    labelEn: 'Overreaching Red Alert',
    labelVi: 'Cảnh Báo Đỏ Quá Tải',
    tagEn: 'RED · RECOVER',
    tagVi: 'ĐỎ · PHỤC HỒI',
    input: {
      age: 31,
      restingHr: 64,
      customMaxHr: null,
      athleteTier: 'hybrid_competitor',
      hrvTodayMs: 49,
      hrvBaselineMs: 74,
      sleepHours: 5.0,
      acuteLoadAu: 3320,
      chronicLoadAu: 2050,
      subjectiveReadiness: 3,
    },
  },
];

interface TierPhysiologyConfig {
  totalWeeklyMinutes: number;
  lt1PctHrr: number;
  lt2PctHrr: number;
  baselineLactate: number;
}

const TIER_CONFIG: Record<AthleteTier, TierPhysiologyConfig> = {
  executive_wellness: {
    totalWeeklyMinutes: 240,
    lt1PctHrr: 66,
    lt2PctHrr: 81,
    baselineLactate: 0.9,
  },
  hybrid_competitor: {
    totalWeeklyMinutes: 360,
    lt1PctHrr: 70,
    lt2PctHrr: 85,
    baselineLactate: 0.85,
  },
  marathon_elite: {
    totalWeeklyMinutes: 540,
    lt1PctHrr: 74,
    lt2PctHrr: 89,
    baselineLactate: 0.8,
  },
};

// Seiler 80/20 Polarized shares across Z1..Z5: 20% + 60% = 80% Low, 5% Z3, 10% + 5% = 15% High (Total Z3-Z5 = 20%)
const ZONE_SPECS: Array<{
  zone: 1 | 2 | 3 | 4 | 5;
  code: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';
  pctMin: number;
  pctMax: number;
  weeklySharePct: number;
  nameEn: string;
  nameVi: string;
  lactateRangeMmol: string;
  fuelSystemEn: string;
  fuelSystemVi: string;
}> = [
  {
    zone: 1,
    code: 'Z1',
    pctMin: 50,
    pctMax: 60,
    weeklySharePct: 20,
    nameEn: 'Active Recovery',
    nameVi: 'Phục Hồi Chủ Động',
    lactateRangeMmol: '0.8–1.4',
    fuelSystemEn: 'Fat Oxidation · Parasympathetic Flush',
    fuelSystemVi: 'Đốt Mỡ · Tái Tạo Thần Kinh Phó Giao Cảm',
  },
  {
    zone: 2,
    code: 'Z2',
    pctMin: 60,
    pctMax: 70,
    weeklySharePct: 60,
    nameEn: 'Aerobic Base',
    nameVi: 'Nền Tảng Hiếu Khí',
    lactateRangeMmol: '1.4–2.0',
    fuelSystemEn: 'Mitochondrial Density · Capillary Growth',
    fuelSystemVi: 'Mật Độ Ti Thể · Phát Triển Mao Mạch',
  },
  {
    zone: 3,
    code: 'Z3',
    pctMin: 70,
    pctMax: 80,
    weeklySharePct: 5,
    nameEn: 'Tempo / Marathon',
    nameVi: 'Nhịp Độ Tempo',
    lactateRangeMmol: '2.0–3.2',
    fuelSystemEn: 'Aerobic Glycolysis · Muscular Stamina',
    fuelSystemVi: 'Đường Phân Hiếu Khí · Sức Bền Cơ Bắp',
  },
  {
    zone: 4,
    code: 'Z4',
    pctMin: 80,
    pctMax: 90,
    weeklySharePct: 10,
    nameEn: 'Lactate Threshold',
    nameVi: 'Ngưỡng Lactate LT2',
    lactateRangeMmol: '3.2–5.5',
    fuelSystemEn: 'Lactate Clearance · Buffering Capacity',
    fuelSystemVi: 'Đào Thải Lactate · Chịu Đựng Ngưỡng',
  },
  {
    zone: 5,
    code: 'Z5',
    pctMin: 90,
    pctMax: 100,
    weeklySharePct: 5,
    nameEn: 'VO2 Max Peak',
    nameVi: 'Đỉnh Công Suất VO2 Max',
    lactateRangeMmol: '5.5–11.0',
    fuelSystemEn: 'Cardiac Stroke Volume · Anaerobic Power',
    fuelSystemVi: 'Thể Tích Nhát Bóp Tim · Công Suất Kỵ Khí',
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function roundAway(v: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  const sign = v < 0 ? -1 : 1;
  const res = (sign * Math.floor(Math.abs(v) * factor + 0.5 + 1e-12)) / factor;
  return Object.is(res, -0) ? 0 : res;
}

export function computeTanakaMaxHr(age: number): number {
  const safeAge = clamp(roundAway(age), 18, 75);
  return roundAway(208 - 0.7 * safeAge);
}

export function computeUthSorensenVo2Max(maxHr: number, restingHr: number): number {
  const safeRhr = Math.max(30, restingHr);
  return roundAway(15.3 * (maxHr / safeRhr), 1);
}

export function computeVo2Percentile(vo2Max: number, age: number): {
  percentile: number;
  rating: Vo2Rating;
} {
  const refMedian = clamp(44.0 - (age - 25) * 0.34, 26.0, 46.0);
  const z = (vo2Max - refMedian) / 7.5;
  const logistic = 100 / (1 + Math.exp(-1.55 * z));
  const percentile = clamp(roundAway(logistic), 5, 99);

  let rating: Vo2Rating = 'Developing';
  if (percentile >= 90) rating = 'Superior';
  else if (percentile >= 75) rating = 'Excellent';
  else if (percentile >= 55) rating = 'Good';
  else if (percentile >= 35) rating = 'Fair';

  return { percentile, rating };
}

export function computeLactateAtPctHrr(
  pctHrr: number,
  tier: AthleteTier
): number {
  const cfg = TIER_CONFIG[tier];
  const a = 2.0 - cfg.baselineLactate;
  const k = Math.log((4.0 - cfg.baselineLactate) / a) / (cfg.lt2PctHrr - cfg.lt1PctHrr);
  const raw = cfg.baselineLactate + a * Math.exp(k * (pctHrr - cfg.lt1PctHrr));
  return roundAway(clamp(raw, 0.7, 13.5), 2);
}

export function classifyAcwrBand(acwr: number): {
  band: AcwrBand;
  labelEn: string;
  labelVi: string;
} {
  if (acwr < 0.8) {
    return {
      band: 'undertrained',
      labelEn: 'Undertrained (<0.80)',
      labelVi: 'Thiếu Tải (<0.80)',
    };
  }
  if (acwr <= 1.3) {
    return {
      band: 'optimal',
      labelEn: 'Optimal Sweet Spot (0.80–1.30)',
      labelVi: 'Vùng Tối Ưu (0.80–1.30)',
    };
  }
  if (acwr <= 1.5) {
    return {
      band: 'caution',
      labelEn: 'Caution Zone (1.31–1.50)',
      labelVi: 'Cảnh Báo Tải (1.31–1.50)',
    };
  }
  return {
    band: 'high_injury_risk',
    labelEn: 'High Injury Risk (>1.50)',
    labelVi: 'Nguy Cơ Chấn Thương Cao (>1.50)',
  };
}

function zoneCodeForPctHrr(pctHrr: number): 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' {
  if (pctHrr < 60) return 'Z1';
  if (pctHrr < 70) return 'Z2';
  if (pctHrr < 80) return 'Z3';
  if (pctHrr < 90) return 'Z4';
  return 'Z5';
}

function buildDailyPrescription(score: number): DailySessionPrescription {
  if (score >= 72) {
    return {
      tier: 'GREEN',
      code: 'PEAK_OUTPUT',
      headlineEn: 'GREEN Peak Output — Full Threshold Intervals',
      headlineVi: 'XANH Đỉnh Cao — Đủ Tải Ngưỡng Lactate Z4/Z5',
      targetZoneEn: 'Z4–Z5 Threshold / VO2 Intervals',
      targetZoneVi: 'Vùng Z4–Z5 Ngưỡng Lactate / VO2 Max',
      detailEn:
        'Autonomic balance & ACWR are primed. Execute full 4×8m LT2 intervals or heavy compound peaking lifts, finished with 10m Z1 parasympathetic flush.',
      detailVi:
        'Cân bằng thần kinh tự chủ và ACWR đạt đỉnh. Thực hiện trọn bộ 4×8p ngưỡng LT2 hoặc sức mạnh tối đa, kết thúc bằng 10p thả lỏng Z1.',
      volumeModifierPct: 100,
    };
  }

  if (score >= 45) {
    return {
      tier: 'AMBER',
      code: 'MODIFY_AEROBIC',
      headlineEn: 'AMBER Modify — Cap at Z2 Aerobic Base',
      headlineVi: 'VÀNG Điều Chỉnh — Giới Hạn Nền Hiếu Khí Z2',
      targetZoneEn: 'Z2 Aerobic Base (60–70% HRR)',
      targetZoneVi: 'Vùng Z2 Nền Hiếu Khí (60–70% HRR)',
      detailEn:
        'Mild sympathetic fatigue or elevated ACWR detected. Reduce total volume 30%, cap heart rate strictly below LT1 aerobic turnpoint, add 1,000mg sodium + extra sleep.',
      detailVi:
        'Phát hiện mệt mỏi giao cảm nhẹ hoặc ACWR tăng. Giảm 30% tổng khối lượng, giữ nhịp tim dưới ngưỡng LT1 và ưu tiên điện giải + ngủ sâu.',
      volumeModifierPct: 70,
    };
  }

  return {
    tier: 'RED',
    code: 'RECOVER_RESTORATIVE',
    headlineEn: 'RED Recover — 35m Mobility & Cold Plunge',
    headlineVi: 'ĐỎ Phục Hồi — 35p Linh Hoạt & Ngâm Lạnh 4.8°C',
    targetZoneEn: 'Z1 Parasympathetic Restore (<60% HRR)',
    targetZoneVi: 'Vùng Z1 Phục Hồi Phó Giao Cảm (<60% HRR)',
    detailEn:
      'High injury-risk ACWR spike or steep HRV suppression. Cancel anaerobic intervals; perform 35m Reformer mobility, nasal breathwork, and 4.8°C basalt contrast therapy.',
    detailVi:
      'Cảnh báo ACWR quá tải hoặc HRV tụt sâu. Hủy toàn bộ bài tập kỵ khí; thay bằng 35p Reformer linh hoạt, hít thở mũi và ngâm lạnh đá bazan 4.8°C.',
    volumeModifierPct: 35,
  };
}

export function computeReadinessZones(
  raw: ReadinessZonesInput
): ReadinessZonesResult {
  const age = clamp(roundAway(raw.age), 18, 75);
  const restingHr = clamp(roundAway(raw.restingHr), 38, 90);
  const autoMaxHr = computeTanakaMaxHr(age);

  const hasCustomMax =
    raw.customMaxHr !== null &&
    Number.isFinite(raw.customMaxHr) &&
    raw.customMaxHr >= 130 &&
    raw.customMaxHr <= 225;

  const candidateMaxHr = hasCustomMax
    ? roundAway(raw.customMaxHr as number)
    : autoMaxHr;
  const maxHr = Math.max(restingHr + 40, candidateMaxHr);
  const maxHrSource: 'tanaka_auto' | 'custom_override' = hasCustomMax
    ? 'custom_override'
    : 'tanaka_auto';
  const heartRateReserve = maxHr - restingHr;

  const tierCfg = TIER_CONFIG[raw.athleteTier];
  const vo2MaxMlKgMin = computeUthSorensenVo2Max(maxHr, restingHr);
  const { percentile: vo2Percentile, rating: vo2Rating } = computeVo2Percentile(
    vo2MaxMlKgMin,
    age
  );

  // Strict monotonically increasing, non-overlapping Karvonen BPM bands (Z1-Z5)
  const zones: KarvonenZone[] = ZONE_SPECS.map((spec, idx) => {
    const rawMin = roundAway(restingHr + (spec.pctMin / 100) * heartRateReserve);
    const maxBpm =
      spec.zone === 5
        ? maxHr
        : roundAway(restingHr + (spec.pctMax / 100) * heartRateReserve);
    const minBpm = idx === 0 ? rawMin : rawMin + 1;
    const weeklyMinutes = roundAway(
      (tierCfg.totalWeeklyMinutes * spec.weeklySharePct) / 100
    );

    return {
      zone: spec.zone,
      code: spec.code,
      nameEn: spec.nameEn,
      nameVi: spec.nameVi,
      pctHrrMin: spec.pctMin,
      pctHrrMax: spec.pctMax,
      minBpm,
      maxBpm,
      weeklyMinutes,
      weeklySharePct: spec.weeklySharePct,
      lactateRangeMmol: spec.lactateRangeMmol,
      fuelSystemEn: spec.fuelSystemEn,
      fuelSystemVi: spec.fuelSystemVi,
    };
  });

  const lowIntensityMinutes = zones[0].weeklyMinutes + zones[1].weeklyMinutes;
  const tempoMinutes = zones[2].weeklyMinutes;
  const highIntensityMinutes = zones[3].weeklyMinutes + zones[4].weeklyMinutes;
  const moderateAndHighMinutes = tempoMinutes + highIntensityMinutes;

  const polarizedSplit: PolarizedSplitSummary = {
    totalWeeklyMinutes: tierCfg.totalWeeklyMinutes,
    lowIntensityMinutes,
    tempoMinutes,
    highIntensityMinutes,
    moderateAndHighMinutes,
    lowIntensityPct: 80,
    highIntensityPct: 20,
  };

  // Blood Lactate Curve (45%..100% HRR in 5% steps) + exact LT1 (2.0) and LT2 (4.0) markers
  const lactateCurve: LactateCurvePoint[] = [];
  for (let pct = 45; pct <= 100; pct += 5) {
    lactateCurve.push({
      pctHrr: pct,
      bpm: roundAway(restingHr + (pct / 100) * heartRateReserve),
      lactateMmol: computeLactateAtPctHrr(pct, raw.athleteTier),
      zoneCode: zoneCodeForPctHrr(pct),
    });
  }

  const lt1: LactateThresholdMarker = {
    label: 'LT1',
    pctHrr: tierCfg.lt1PctHrr,
    bpm: roundAway(restingHr + (tierCfg.lt1PctHrr / 100) * heartRateReserve),
    lactateMmol: 2.0,
    descriptionEn: 'Aerobic Threshold · Fat-Oxidation Ceiling (2.0 mmol/L)',
    descriptionVi: 'Ngưỡng Hiếu Khí LT1 · Trần Đốt Mỡ (2.0 mmol/L)',
  };

  const lt2: LactateThresholdMarker = {
    label: 'LT2',
    pctHrr: tierCfg.lt2PctHrr,
    bpm: roundAway(restingHr + (tierCfg.lt2PctHrr / 100) * heartRateReserve),
    lactateMmol: 4.0,
    descriptionEn: 'Anaerobic Turnpoint · Maximal Lactate Steady State (4.0 mmol/L)',
    descriptionVi: 'Điểm Bùng Phát Kỵ Khí LT2 · Ngưỡng Bền Lactate (4.0 mmol/L)',
  };

  // Autonomic HRV & ACWR Readiness Engine
  const hrvTodayMs = clamp(roundAway(raw.hrvTodayMs), 15, 180);
  const hrvBaselineMs = clamp(roundAway(raw.hrvBaselineMs), 20, 160);
  const sleepHours = clamp(roundAway(raw.sleepHours, 1), 4.0, 9.5);
  const acuteLoadAu = clamp(roundAway(raw.acuteLoadAu), 0, 6000);
  const chronicLoadAu = clamp(roundAway(raw.chronicLoadAu), 200, 5000);
  const subjectiveReadiness = clamp(roundAway(raw.subjectiveReadiness), 1, 10);

  const hrvDeltaPct = roundAway(
    ((hrvTodayMs - hrvBaselineMs) / hrvBaselineMs) * 100,
    1
  );
  const acwr = roundAway(acuteLoadAu / chronicLoadAu, 2);
  const acwrMeta = classifyAcwrBand(acwr);

  const hrvScore = clamp(76 + hrvDeltaPct * 1.45, 10, 100);
  const sleepScore =
    sleepHours >= 8.0
      ? clamp(100 - Math.max(0, sleepHours - 9.0) * 6, 85, 100)
      : clamp(100 - (8.0 - sleepHours) * 20, 15, 100);

  let acwrScore: number;
  if (acwr < 0.8) {
    acwrScore = clamp(78 - (0.8 - acwr) * 45, 45, 78);
  } else if (acwr <= 1.3) {
    acwrScore = clamp(96 - Math.abs(acwr - 1.05) * 28, 86, 98);
  } else if (acwr <= 1.5) {
    acwrScore = clamp(65 - (acwr - 1.3) * 120, 40, 65);
  } else {
    acwrScore = clamp(32 - (acwr - 1.5) * 45, 5, 32);
  }

  const subjectiveScore = clamp(subjectiveReadiness * 10, 10, 100);

  let weightedScore =
    0.38 * hrvScore +
    0.24 * sleepScore +
    0.23 * acwrScore +
    0.15 * subjectiveScore;

  // Sports-science physiological safety cap guardrails
  if (acwr > 1.5 || hrvDeltaPct <= -22) {
    weightedScore = Math.min(weightedScore, 44);
  } else if (acwr > 1.3 || hrvDeltaPct <= -12 || sleepHours < 5.5) {
    weightedScore = Math.min(weightedScore, 68);
  }

  const compositeReadinessScore = clamp(roundAway(weightedScore), 0, 100);
  const prescription = buildDailyPrescription(compositeReadinessScore);

  // Deterministic 7-day HRV & ACWR telemetry trend ending cleanly on Today (D-0)
  const dayWeights = [0.05, 0.16, 0.28, 0.44, 0.62, 0.82, 1.0];
  const dayWave = [-0.03, 0.04, -0.02, 0.03, -0.04, 0.02, 0.0];
  const dayLabels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];

  const telemetry7Day: TelemetryDayPoint[] = dayLabels.map((dayLabel, i) => {
    const t = dayWeights[i];
    const wave = dayWave[i];
    const hrvVal =
      i === 6
        ? hrvTodayMs
        : clamp(
            roundAway(
              hrvBaselineMs +
                (hrvTodayMs - hrvBaselineMs) * t +
                hrvBaselineMs * wave
            ),
            15,
            180
          );
    const acwrVal =
      i === 6
        ? acwr
        : roundAway(
            clamp(1.0 + (acwr - 1.0) * t + wave * 0.8, 0.45, 2.2),
            2
          );
    const estReadiness =
      i === 6
        ? compositeReadinessScore
        : clamp(
            roundAway(
              76 +
                ((hrvVal - hrvBaselineMs) / hrvBaselineMs) * 110 -
                Math.max(0, acwrVal - 1.3) * 85
            ),
            15,
            99
          );
    return {
      dayLabel,
      hrvMs: hrvVal,
      acwr: acwrVal,
      readinessEst: estReadiness,
    };
  });

  return {
    age,
    restingHr,
    maxHr,
    maxHrSource,
    heartRateReserve,
    athleteTier: raw.athleteTier,
    vo2MaxMlKgMin,
    vo2Percentile,
    vo2Rating,
    zones,
    polarizedSplit,
    lactateCurve,
    lt1,
    lt2,
    hrvTodayMs,
    hrvBaselineMs,
    hrvDeltaPct,
    acwr,
    acwrBand: acwrMeta.band,
    acwrLabelEn: acwrMeta.labelEn,
    acwrLabelVi: acwrMeta.labelVi,
    compositeReadinessScore,
    readinessTier: prescription.tier,
    prescription,
    telemetry7Day,
  };
}

export function exportReadinessCsv(result: ReadinessZonesResult): string {
  const header = [
    'Zone',
    'Name',
    'Pct_HRR_Range',
    'BPM_Range',
    'Weekly_Minutes_80_20',
    'Weekly_Share_Pct',
    'Lactate_Range_mmolL',
    'Primary_Fuel_System',
  ].join(',');

  const rows = result.zones.map((z) =>
    [
      z.code,
      `"${z.nameEn}"`,
      `${z.pctHrrMin}-${z.pctHrrMax}%`,
      `${z.minBpm}-${z.maxBpm}`,
      z.weeklyMinutes,
      `${z.weeklySharePct}%`,
      z.lactateRangeMmol,
      `"${z.fuelSystemEn}"`,
    ].join(',')
  );

  const summary = [
    '',
    `Summary,VO2Max_mL_kg_min,${result.vo2MaxMlKgMin},Percentile,${result.vo2Percentile},Rating,${result.vo2Rating}`,
    `Summary,LT1_2mmol_BPM,${result.lt1.bpm},LT1_PctHRR,${result.lt1.pctHrr}%,LT2_4mmol_BPM,${result.lt2.bpm},LT2_PctHRR,${result.lt2.pctHrr}%`,
    `Summary,HRV_rMSSD_ms,${result.hrvTodayMs},Baseline_ms,${result.hrvBaselineMs},Delta_Pct,${result.hrvDeltaPct}%`,
    `Summary,ACWR,${result.acwr},ACWR_Band,${result.acwrBand},Readiness_Score,${result.compositeReadinessScore},Tier,${result.readinessTier}`,
  ];

  return `\uFEFF${[header, ...rows, ...summary].join('\n')}`;
}
