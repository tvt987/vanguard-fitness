export type KarvonenZoneCode = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export type AcwrVerdict = 'OPTIMAL' | 'OVERREACH' | 'INJURY DANGER';

export type BodySystemId =
  | 'cardiopulmonary'
  | 'core'
  | 'quadriceps'
  | 'hamstrings_glutes'
  | 'calves_achilles';

export type BioCameraMode = 'studio_orbit' | 'bio_xray' | 'side_gait';

export type BioProtocolMode = 'LIVE_TELEMETRY' | 'OVERTRAINING_SPIKE' | 'AUTONOMIC_DELOAD';

export interface BioStudioState {
  intensityW: number; // 100..380 W
  acwr: number; // 0.70..1.80
  protocolMode: BioProtocolMode;
  selectedSystem: BodySystemId;
  cameraMode: BioCameraMode;
}

export interface GaitPose {
  phaseRad: number;
  cadenceSpm: number; // 154..194 spm
  strideFrequencyHz: number; // full L+R cycle Hz
  groundSpeedKmh: number; // 8.5..21.2 km/h
  strideLengthM: number; // meters per step
  pelvisYOffset: number; // vertical oscillation meters
  pelvisYaw: number; // hip rotation rad
  torsoForwardLean: number; // rad
  torsoTwist: number; // counter-rotation rad
  headNod: number; // stabilization rad
  leftHipPitch: number;
  rightHipPitch: number;
  leftKneeFlex: number; // >= 0 rad
  rightKneeFlex: number; // >= 0 rad
  leftAnklePitch: number;
  rightAnklePitch: number;
  leftShoulderPitch: number;
  rightShoulderPitch: number;
  leftElbowFlex: number; // rad
  rightElbowFlex: number; // rad
  heartPulseScale: number; // 1.0..1.24 systolic lub-dub
  lungExpansionScale: number; // 0.96..1.10 respiratory cycle
  asymmetryPct: number; // rises under ACWR > 1.50 fatigue
  verticalShockG: number; // ground-reaction impact peak
}

export interface BodySystemTelemetry {
  id: BodySystemId;
  labelEn: string;
  labelVi: string;
  shortLabelEn: string;
  shortLabelVi: string;
  activation: number; // 0..1 normalized thermal intensity
  hexColor: string;
  smo2Pct: number; // Muscle Oxygenation SmO2 % (28..84%)
  lactateClearanceMmolMin: number; // positive = net clearance, negative = net accumulation
  jointImpactG: number; // G-force stress load
  stressAlert: boolean; // crimson joint warning under ACWR > 1.50
  clinicalNoteEn: string;
  clinicalNoteVi: string;
}

export interface BioTelemetrySnapshot {
  intensityW: number;
  acwr: number;
  intensityNorm: number; // 0..1
  pctHrr: number; // 50..100
  heartRateBpm: number; // ~120..188 bpm
  karvonenZone: KarvonenZoneCode;
  zoneLabelEn: string;
  zoneLabelVi: string;
  zoneColorHex: string;
  bloodLactateMmol: number; // 0.90..8.40 mmol/L
  lactateBand: 'SUB_LT1' | 'AEROBIC_TRANSITION' | 'ABOVE_LT2';
  lt1Crossed: boolean;
  lt2Crossed: boolean;
  vo2MlKgMin: number; // 28.0..66.5 mL/kg/min
  respiratoryRateBpm: number; // 18..54 breaths/min
  cadenceSpm: number; // 154..194 spm
  hrvReadinessPct: number; // 18..98 %
  hrvMs: number; // rMSSD ms
  acwrVerdict: AcwrVerdict;
  jointWarningActive: boolean;
  bodySystems: Record<BodySystemId, BodySystemTelemetry>;
}

export const MIN_POWER_W = 100;
export const MAX_POWER_W = 380;
export const MIN_ACWR = 0.7;
export const MAX_ACWR = 1.8;

export const LT1_MMOL = 2.0;
export const LT2_MMOL = 4.0;

const BASE_RESTING_HR = 52;
const BASE_MAX_HR = 188;
const BASE_HRR = BASE_MAX_HR - BASE_RESTING_HR; // 136 bpm

export const BODY_SYSTEM_ORDER: BodySystemId[] = [
  'cardiopulmonary',
  'core',
  'quadriceps',
  'hamstrings_glutes',
  'calves_achilles',
];

export const DEFAULT_BIO_STUDIO_STATE: BioStudioState = {
  intensityW: 240,
  acwr: 1.04,
  protocolMode: 'LIVE_TELEMETRY',
  selectedSystem: 'cardiopulmonary',
  cameraMode: 'studio_orbit',
};

export interface PowerPreset {
  id: 'recovery' | 'tempo' | 'vo2max';
  watts: number;
  labelEn: string;
  labelVi: string;
  subEn: string;
  subVi: string;
}

export const POWER_PRESETS: PowerPreset[] = [
  {
    id: 'recovery',
    watts: 100,
    labelEn: '100W Recovery',
    labelVi: '100W Phục Hồi',
    subEn: 'Z1 Fat Oxidation',
    subVi: 'Z1 Đốt Mỡ',
  },
  {
    id: 'tempo',
    watts: 240,
    labelEn: '240W LT2 Tempo',
    labelVi: '240W Nhịp Độ LT2',
    subEn: 'Z3 Aerobic Engine',
    subVi: 'Z3 Nền Hiếu Khí',
  },
  {
    id: 'vo2max',
    watts: 380,
    labelEn: '380W VO2max Sprint',
    labelVi: '380W Nước Rút VO2',
    subEn: 'Z5 Redline Peak',
    subVi: 'Z5 Đỉnh Kỵ Khí',
  },
];

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function roundTo(v: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  const res = Math.round((v + Number.EPSILON) * factor) / factor;
  return Object.is(res, -0) ? 0 : res;
}

export function normalizePower(intensityW: number): number {
  const safeW = clamp(intensityW, MIN_POWER_W, MAX_POWER_W);
  return (safeW - MIN_POWER_W) / (MAX_POWER_W - MIN_POWER_W);
}

export function computeCadenceSpm(intensityW: number): number {
  const t = normalizePower(intensityW);
  return roundTo(154 + t * 40, 1);
}

export function classifyAcwrVerdict(acwr: number): AcwrVerdict {
  const safeAcwr = clamp(acwr, MIN_ACWR, MAX_ACWR);
  if (safeAcwr > 1.5) return 'INJURY DANGER';
  if (safeAcwr > 1.3) return 'OVERREACH';
  return 'OPTIMAL';
}

export function zoneHexForCode(zone: KarvonenZoneCode): string {
  switch (zone) {
    case 'Z1':
      return '#06b6d4'; // Cyan
    case 'Z2':
      return '#0891b2'; // Deep Cyan / Teal
    case 'Z3':
      return '#10b981'; // Electric Jade / Emerald
    case 'Z4':
      return '#f59e0b'; // Amber / Terracotta
    case 'Z5':
      return '#ef4444'; // Crimson Redline
  }
}

export function thermalHexForActivation(
  activation: number,
  forceDanger = false
): string {
  if (forceDanger) return '#ef4444';
  const a = clamp(activation, 0, 1);
  if (a < 0.42) return '#06b6d4'; // Cyan (Z1/Z2 Fat Oxidation)
  if (a < 0.66) return '#10b981'; // Emerald (Z3 Aerobic)
  if (a < 0.84) return '#f59e0b'; // Amber (Z4 LT2 Threshold)
  return '#ef4444'; // Crimson (Z5 VO2max Redline)
}

export function computeBioTelemetry(
  intensityW: number,
  acwr: number
): BioTelemetrySnapshot {
  const safeW = roundTo(clamp(intensityW, MIN_POWER_W, MAX_POWER_W), 0);
  const safeAcwr = roundTo(clamp(acwr, MIN_ACWR, MAX_ACWR), 2);
  const t = normalizePower(safeW);

  // Karvonen %HRR spans 50% (100W) -> 100% (380W), with mild sympathetic drift if ACWR > 1.30
  const cardiacDriftPct = safeAcwr > 1.3 ? (safeAcwr - 1.3) * 7.5 : 0;
  const pctHrr = roundTo(clamp(50 + t * 50 + cardiacDriftPct, 50, 100), 1);
  const heartRateBpm = Math.round(BASE_RESTING_HR + (pctHrr / 100) * BASE_HRR);

  let karvonenZone: KarvonenZoneCode;
  let zoneLabelEn: string;
  let zoneLabelVi: string;

  if (pctHrr < 60) {
    karvonenZone = 'Z1';
    zoneLabelEn = 'Z1 Active Recovery';
    zoneLabelVi = 'Z1 Phục Hồi Chủ Động';
  } else if (pctHrr < 70) {
    karvonenZone = 'Z2';
    zoneLabelEn = 'Z2 Fat Oxidation';
    zoneLabelVi = 'Z2 Đốt Mỡ Hiếu Khí';
  } else if (pctHrr < 80) {
    karvonenZone = 'Z3';
    zoneLabelEn = 'Z3 Aerobic Tempo';
    zoneLabelVi = 'Z3 Nhịp Độ Hiếu Khí';
  } else if (pctHrr < 90) {
    karvonenZone = 'Z4';
    zoneLabelEn = 'Z4 LT2 Threshold';
    zoneLabelVi = 'Z4 Ngưỡng Lactate LT2';
  } else {
    karvonenZone = 'Z5';
    zoneLabelEn = 'Z5 VO2max Redline';
    zoneLabelVi = 'Z5 Đỉnh VO2max';
  }

  const zoneColorHex = zoneHexForCode(karvonenZone);

  // Smooth exponential lactate curve: 0.90 mmol/L @ 100W -> 8.40 mmol/L @ 380W
  // Crosses LT1 (2.0 mmol/L) around 196W and LT2 (4.0 mmol/L) around 283W
  const k = 2.1;
  const expDenom = Math.exp(k) - 1;
  const rawLactate = 0.9 + 7.5 * ((Math.exp(k * t) - 1) / expDenom);
  const bloodLactateMmol = roundTo(clamp(rawLactate, 0.9, 8.4), 2);

  const lt1Crossed = bloodLactateMmol >= LT1_MMOL;
  const lt2Crossed = bloodLactateMmol >= LT2_MMOL;
  const lactateBand: BioTelemetrySnapshot['lactateBand'] = lt2Crossed
    ? 'ABOVE_LT2'
    : lt1Crossed
      ? 'AEROBIC_TRANSITION'
      : 'SUB_LT1';

  // Oxygen consumption VO2 (mL/kg/min): 28.0 @ 100W -> 66.5 @ 380W
  const vo2MlKgMin = roundTo(28.0 + t * 38.5, 1);
  const respiratoryRateBpm = Math.round(18 + t * 36);
  const cadenceSpm = computeCadenceSpm(safeW);

  // Autonomic HRV Readiness % driven primarily by ACWR load balance + acute strain
  let baseReadiness: number;
  if (safeAcwr <= 1.15) {
    // Sweet spot peak recovery (e.g., 0.98 deload -> ~94%, 1.04 -> ~91%)
    baseReadiness = 96 - Math.abs(safeAcwr - 0.96) * 28;
  } else if (safeAcwr <= 1.3) {
    baseReadiness = 90 - (safeAcwr - 1.15) * 85;
  } else if (safeAcwr <= 1.5) {
    baseReadiness = 75 - (safeAcwr - 1.3) * 145;
  } else {
    // Severe sympathetic suppression above 1.50
    baseReadiness = 44 - (safeAcwr - 1.5) * 95;
  }

  // Modest acute effort modulation so recovery/deload rebounds cleanly
  const acuteEffortPenalty = t * 6.5;
  const hrvReadinessPct = Math.round(
    clamp(baseReadiness - acuteEffortPenalty, 18, 98)
  );
  const hrvMs = Math.round(clamp(34 + (hrvReadinessPct / 100) * 68, 32, 108));

  const acwrVerdict = classifyAcwrVerdict(safeAcwr);
  const jointWarningActive = acwrVerdict === 'INJURY DANGER';

  // Per-body-system thermal activation (0..1), SmO2 %, Lactate clearance, Joint G-Force
  const acwrStrainBoost = safeAcwr > 1.3 ? clamp((safeAcwr - 1.3) * 0.48, 0, 0.24) : 0;

  const actCardio = roundTo(clamp(0.26 + t * 0.72 + acwrStrainBoost * 0.35, 0.18, 1.0), 3);
  const actCore = roundTo(clamp(0.22 + t * 0.64 + acwrStrainBoost * 0.25, 0.16, 0.96), 3);
  const actQuads = roundTo(clamp(0.24 + t * 0.72 + acwrStrainBoost * 0.55, 0.18, 1.0), 3);
  const actHams = roundTo(clamp(0.2 + t * 0.76 + acwrStrainBoost * 0.45, 0.16, 1.0), 3);
  const actCalves = roundTo(clamp(0.27 + t * 0.71 + acwrStrainBoost * 0.65, 0.2, 1.0), 3);

  const jointMultiplier = safeAcwr > 1.5 ? 1.24 : safeAcwr > 1.3 ? 1.1 : 1.0;

  // Lactate clearance balance (mmol/L/min): positive below LT2, flips negative above LT2
  const baseClearance = roundTo(0.85 - (bloodLactateMmol - 0.9) * 0.27, 2);

  const bodySystems: Record<BodySystemId, BodySystemTelemetry> = {
    cardiopulmonary: {
      id: 'cardiopulmonary',
      labelEn: 'Cardiopulmonary Heart / Lungs',
      labelVi: 'Tim Mạch & Hô Hấp',
      shortLabelEn: 'Heart & Lungs',
      shortLabelVi: 'Tim & Phổi',
      activation: actCardio,
      hexColor: thermalHexForActivation(actCardio, false),
      smo2Pct: Math.round(clamp(82 - t * 38 - acwrStrainBoost * 18, 34, 84)),
      lactateClearanceMmolMin: roundTo(baseClearance + 0.18, 2),
      jointImpactG: roundTo((1.2 + t * 1.1) * jointMultiplier, 2),
      stressAlert: false,
      clinicalNoteEn:
        karvonenZone === 'Z5'
          ? 'Cardiac output peaking near stroke-volume ceiling; ventilatory threshold exceeded.'
          : karvonenZone === 'Z4'
            ? 'Sustained aerobic-anaerobic transition; myocardial O2 extraction elevated.'
            : 'Optimal stroke-volume efficiency with strong parasympathetic reserve.',
      clinicalNoteVi:
        karvonenZone === 'Z5'
          ? 'Cung lượng tim đạt trần thể tích nhát bóp; vượt ngưỡng thông khí.'
          : karvonenZone === 'Z4'
            ? 'Chuyển tiếp hiếu khí - kỵ khí cường độ cao; hấp thụ O2 cơ tim tăng mạnh.'
            : 'Hiệu suất nhát bóp tim tối ưu với biên độ dự trữ phó giao cảm tốt.',
    },
    core: {
      id: 'core',
      labelEn: 'Core Stabilizers',
      labelVi: 'Cơ Lõi Ổn Định Trục',
      shortLabelEn: 'Core Axis',
      shortLabelVi: 'Cơ Lõi',
      activation: actCore,
      hexColor: thermalHexForActivation(actCore, false),
      smo2Pct: Math.round(clamp(79 - t * 32 - acwrStrainBoost * 14, 40, 82)),
      lactateClearanceMmolMin: roundTo(baseClearance + 0.1, 2),
      jointImpactG: roundTo((1.5 + t * 1.3) * jointMultiplier, 2),
      stressAlert: false,
      clinicalNoteEn:
        'Anti-rotation pelvic stabilization absorbing hip-shoulder counter-torque.',
      clinicalNoteVi:
        'Ổn định chống xoay khung chậu, hấp thụ mô-men đối xứng vai-hông.',
    },
    quadriceps: {
      id: 'quadriceps',
      labelEn: 'Quadriceps & Patellar Joint',
      labelVi: 'Cơ Đùi Trước & Khớp Gối',
      shortLabelEn: 'Quadriceps',
      shortLabelVi: 'Cơ Đùi Trước',
      activation: actQuads,
      hexColor: thermalHexForActivation(actQuads, jointWarningActive),
      smo2Pct: Math.round(clamp(76 - t * 44 - acwrStrainBoost * 22, 28, 78)),
      lactateClearanceMmolMin: roundTo(baseClearance - 0.12, 2),
      jointImpactG: roundTo((2.1 + t * 1.75) * jointMultiplier, 2),
      stressAlert: jointWarningActive,
      clinicalNoteEn: jointWarningActive
        ? 'ACWR > 1.50 patellofemoral overload alert — deload eccentric impact immediately.'
        : 'Eccentric braking load balanced across vastus lateralis and knee tendon.',
      clinicalNoteVi: jointWarningActive
        ? 'Cảnh báo quá tải khớp gối ACWR > 1.50 — cần giảm tải lập tức.'
        : 'Tải phanh ly tâm cân bằng giữa cơ tứ đầu đùi và gân bánh chè.',
    },
    hamstrings_glutes: {
      id: 'hamstrings_glutes',
      labelEn: 'Hamstrings & Glutes',
      labelVi: 'Cơ Đùi Sau & Mông',
      shortLabelEn: 'Hamstrings',
      shortLabelVi: 'Đùi Sau & Mông',
      activation: actHams,
      hexColor: thermalHexForActivation(actHams, false),
      smo2Pct: Math.round(clamp(77 - t * 43 - acwrStrainBoost * 18, 29, 79)),
      lactateClearanceMmolMin: roundTo(baseClearance - 0.08, 2),
      jointImpactG: roundTo((1.85 + t * 1.65) * jointMultiplier, 2),
      stressAlert: false,
      clinicalNoteEn:
        'Posterior-chain hip extension drive powering horizontal stride propulsion.',
      clinicalNoteVi:
        'Chuỗi cơ sau duỗi hông tạo lực đẩy sải chân theo phương ngang.',
    },
    calves_achilles: {
      id: 'calves_achilles',
      labelEn: 'Calves & Achilles Tendon',
      labelVi: 'Bắp Chân & Gân Achilles',
      shortLabelEn: 'Calves / Achilles',
      shortLabelVi: 'Bắp Chân / Achilles',
      activation: actCalves,
      hexColor: thermalHexForActivation(actCalves, jointWarningActive),
      smo2Pct: Math.round(clamp(74 - t * 42 - acwrStrainBoost * 24, 27, 76)),
      lactateClearanceMmolMin: roundTo(baseClearance - 0.15, 2),
      jointImpactG: roundTo((2.35 + t * 1.95) * jointMultiplier, 2),
      stressAlert: jointWarningActive,
      clinicalNoteEn: jointWarningActive
        ? 'Achilles tendon peak tensile stress exceeded under ACWR 1.65 spike — prescribe Z2 deload.'
        : 'Elastic stretch-shortening recoil storing ground contact energy cleanly.',
      clinicalNoteVi: jointWarningActive
        ? 'Căng kéo gân Achilles vượt ngưỡng do ACWR 1.65 — cần kê đơn phục hồi Z2.'
        : 'Độ đàn hồi gân Achilles tích trữ và giải phóng lực chạm đất tối ưu.',
    },
  };

  return {
    intensityW: safeW,
    acwr: safeAcwr,
    intensityNorm: roundTo(t, 4),
    pctHrr,
    heartRateBpm,
    karvonenZone,
    zoneLabelEn,
    zoneLabelVi,
    zoneColorHex,
    bloodLactateMmol,
    lactateBand,
    lt1Crossed,
    lt2Crossed,
    vo2MlKgMin,
    respiratoryRateBpm,
    cadenceSpm,
    hrvReadinessPct,
    hrvMs,
    acwrVerdict,
    jointWarningActive,
    bodySystems,
  };
}

/**
 * Pure deterministic sinusoidal gait kinematics solver for 60fps 3D runner animation.
 * `phaseRad` advances continuously at `2 * PI * strideFrequencyHz * dt`.
 */
export function computeGaitPose(
  phaseRad: number,
  intensityW: number,
  acwr: number
): GaitPose {
  const safePhase = Number.isFinite(phaseRad) ? phaseRad : 0;
  const safeW = clamp(intensityW, MIN_POWER_W, MAX_POWER_W);
  const safeAcwr = clamp(acwr, MIN_ACWR, MAX_ACWR);
  const t = normalizePower(safeW);

  const cadenceSpm = computeCadenceSpm(safeW);
  // 1 full gait cycle = 2 steps (left + right footstrike)
  const strideFrequencyHz = roundTo(cadenceSpm / 120, 4);
  const groundSpeedKmh = roundTo(8.5 + t * 12.7, 2);
  const strideLengthM = roundTo((groundSpeedKmh * 1000) / 60 / cadenceSpm, 3);

  // Subtle gait asymmetry rises when overtrained (ACWR > 1.50)
  const fatigueFactor = safeAcwr > 1.5 ? clamp((safeAcwr - 1.5) * 1.4, 0, 0.45) : 0;
  const asymmetryPct = roundTo(0.8 + fatigueFactor * 9.5, 1);

  const sinP = Math.sin(safePhase);
  const cosP = Math.cos(safePhase);
  const sin2P = Math.sin(2 * safePhase - 0.35);

  // Pelvis vertical oscillation: higher flight amplitude as sprint power climbs
  const bounceAmp = 0.042 + t * 0.045;
  const pelvisYOffset = roundTo(Math.abs(sin2P) * bounceAmp - bounceAmp * 0.35, 4);

  // Forward trunk lean scales from relaxed jog (0.09 rad) to sprint drive (0.24 rad)
  const torsoForwardLean = roundTo(0.09 + t * 0.15 + fatigueFactor * 0.03, 4);
  const pelvisYaw = roundTo(sinP * (0.08 + t * 0.07), 4);
  const torsoTwist = roundTo(-sinP * (0.11 + t * 0.11), 4);
  const headNod = roundTo(-torsoForwardLean * 0.55 + Math.cos(2 * safePhase) * 0.025, 4);

  // Hip flexion/extension: forward knee drive is larger than backward extension
  const hipAmp = 0.42 + t * 0.48;
  const hipBias = 0.12 + t * 0.14;
  const leftRawHip = Math.sin(safePhase);
  const rightRawHip = Math.sin(safePhase + Math.PI);

  const leftHipPitch = roundTo(leftRawHip * hipAmp + hipBias, 4);
  const rightHipPitch = roundTo(
    rightRawHip * hipAmp * (1 - fatigueFactor * 0.09) + hipBias,
    4
  );

  // Knee flexion (always >= 0 rad): heel-kick peaks during swing recovery, extends before strike
  const kneeSwingPeak = 0.92 + t * 0.68;
  const kneeStanceFlex = 0.14 + t * 0.08;
  const leftKneePhase = Math.max(0, Math.sin(safePhase - 1.15));
  const rightKneePhase = Math.max(0, Math.sin(safePhase + Math.PI - 1.15));
  const leftStanceAbsorb = Math.max(0, Math.sin(safePhase + 0.55)) * 0.22;
  const rightStanceAbsorb = Math.max(0, Math.sin(safePhase + Math.PI + 0.55)) * 0.22;

  const leftKneeFlex = roundTo(
    clamp(kneeStanceFlex + leftKneePhase * kneeSwingPeak + leftStanceAbsorb, 0.08, 1.85),
    4
  );
  const rightKneeFlex = roundTo(
    clamp(kneeStanceFlex + rightKneePhase * kneeSwingPeak + rightStanceAbsorb, 0.08, 1.85),
    4
  );

  // Ankle dorsiflexion / toe-off plantarflexion
  const ankleAmp = 0.24 + t * 0.22;
  const leftAnklePitch = roundTo(Math.cos(safePhase - 0.4) * ankleAmp, 4);
  const rightAnklePitch = roundTo(Math.cos(safePhase + Math.PI - 0.4) * ankleAmp, 4);

  // Counter-phase arm swing
  const shoulderAmp = 0.44 + t * 0.58;
  const leftShoulderPitch = roundTo(-sinP * shoulderAmp + 0.06, 4);
  const rightShoulderPitch = roundTo(sinP * shoulderAmp + 0.06, 4);

  // Athletic runner elbow carriage (~78-102 deg)
  const elbowBase = 1.32 + t * 0.24;
  const leftElbowFlex = roundTo(clamp(elbowBase - cosP * 0.18, 0.9, 1.9), 4);
  const rightElbowFlex = roundTo(clamp(elbowBase + cosP * 0.18, 0.9, 1.9), 4);

  // Heartbeat double-peak lub-dub synced to HR BPM ratio against gait phase
  const telemetryHr = BASE_RESTING_HR + ((50 + t * 50) / 100) * BASE_HRR;
  const heartCyclesPerGait = (telemetryHr / 60) / strideFrequencyHz;
  const hPhase = ((safePhase * heartCyclesPerGait) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const systole = Math.exp(-Math.pow((hPhase - 0.55) / 0.26, 2));
  const diastole = 0.48 * Math.exp(-Math.pow((hPhase - 1.35) / 0.34, 2));
  const heartPulseScale = roundTo(1.0 + (0.14 + t * 0.1) * (systole + diastole), 4);

  // Respiratory expansion synced to ventilatory cycle
  const lungExpansionScale = roundTo(
    1.0 + Math.sin(safePhase * 0.5) * (0.038 + t * 0.048),
    4
  );

  const verticalShockG = roundTo(
    (2.15 + t * 1.75) * (safeAcwr > 1.5 ? 1.24 : safeAcwr > 1.3 ? 1.09 : 1.0),
    2
  );

  return {
    phaseRad: safePhase,
    cadenceSpm,
    strideFrequencyHz,
    groundSpeedKmh,
    strideLengthM,
    pelvisYOffset,
    pelvisYaw,
    torsoForwardLean,
    torsoTwist,
    headNod,
    leftHipPitch,
    rightHipPitch,
    leftKneeFlex,
    rightKneeFlex,
    leftAnklePitch,
    rightAnklePitch,
    leftShoulderPitch,
    rightShoulderPitch,
    leftElbowFlex,
    rightElbowFlex,
    heartPulseScale,
    lungExpansionScale,
    asymmetryPct,
    verticalShockG,
  };
}

/**
 * Deterministic state transition: injects ACWR 1.65 overtraining spike
 * and ramps into VO2max redline load to surface knee & Achilles injury danger rings.
 */
export function injectOvertrainingSpike(
  prev?: Partial<BioStudioState>
): BioStudioState {
  return {
    intensityW: 380,
    acwr: 1.65,
    protocolMode: 'OVERTRAINING_SPIKE',
    selectedSystem: prev?.selectedSystem ?? 'calves_achilles',
    cameraMode: prev?.cameraMode ?? 'studio_orbit',
  };
}

/**
 * Deterministic state transition: prescribes Emerald Zone-2 Autonomic Deload
 * (ACWR 0.98, sub-LT1 recovery power 165W, HRV rebound).
 */
export function prescribeAutonomicDeload(
  prev?: Partial<BioStudioState>
): BioStudioState {
  return {
    intensityW: 165,
    acwr: 0.98,
    protocolMode: 'AUTONOMIC_DELOAD',
    selectedSystem: 'cardiopulmonary',
    cameraMode: prev?.cameraMode ?? 'studio_orbit',
  };
}
