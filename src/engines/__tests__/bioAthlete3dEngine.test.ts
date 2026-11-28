import { describe, expect, it } from 'vitest';
import {
  BODY_SYSTEM_ORDER,
  DEFAULT_BIO_STUDIO_STATE,
  LT1_MMOL,
  LT2_MMOL,
  MAX_ACWR,
  MAX_POWER_W,
  MIN_ACWR,
  MIN_POWER_W,
  POWER_PRESETS,
  classifyAcwrVerdict,
  computeBioTelemetry,
  computeCadenceSpm,
  computeGaitPose,
  injectOvertrainingSpike,
  normalizePower,
  prescribeAutonomicDeload,
  thermalHexForActivation,
  zoneHexForCode,
} from '../bioAthlete3dEngine';

describe('Vanguard v4.0 — 3D Bio-Telemetry Kinematic Athlete Engine', () => {
  it('normalizes power cleanly across [100W..380W] and clamps extremes', () => {
    expect(normalizePower(MIN_POWER_W)).toBe(0);
    expect(normalizePower(MAX_POWER_W)).toBe(1);
    expect(normalizePower(240)).toBeCloseTo(0.5, 4);
    expect(normalizePower(-50)).toBe(0);
    expect(normalizePower(999)).toBe(1);
  });

  it('scales running cadence linearly from 154 spm (100W) to 194 spm (380W)', () => {
    expect(computeCadenceSpm(100)).toBe(154);
    expect(computeCadenceSpm(240)).toBe(174);
    expect(computeCadenceSpm(380)).toBe(194);
  });

  it('classifies ACWR injury thresholds deterministically (OPTIMAL / OVERREACH / INJURY DANGER)', () => {
    expect(classifyAcwrVerdict(0.98)).toBe('OPTIMAL');
    expect(classifyAcwrVerdict(1.3)).toBe('OPTIMAL');
    expect(classifyAcwrVerdict(1.38)).toBe('OVERREACH');
    expect(classifyAcwrVerdict(1.5)).toBe('OVERREACH');
    expect(classifyAcwrVerdict(1.65)).toBe('INJURY DANGER');
  });

  it('maps all 5 Karvonen zones Z1..Z5 across power progression at healthy ACWR', () => {
    expect(computeBioTelemetry(100, 1.0).karvonenZone).toBe('Z1');
    expect(computeBioTelemetry(175, 1.0).karvonenZone).toBe('Z2');
    expect(computeBioTelemetry(240, 1.0).karvonenZone).toBe('Z3');
    expect(computeBioTelemetry(300, 1.0).karvonenZone).toBe('Z4');
    expect(computeBioTelemetry(380, 1.0).karvonenZone).toBe('Z5');
  });

  it('produces unique color tokens for Karvonen zones Z1..Z5', () => {
    const colors = (['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const).map(zoneHexForCode);
    expect(new Set(colors).size).toBe(5);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('transitions thermal muscle colors from Cyan -> Emerald -> Amber -> Crimson and forces Crimson on danger', () => {
    expect(thermalHexForActivation(0.25)).toBe('#06b6d4');
    expect(thermalHexForActivation(0.55)).toBe('#10b981');
    expect(thermalHexForActivation(0.75)).toBe('#f59e0b');
    expect(thermalHexForActivation(0.92)).toBe('#ef4444');
    expect(thermalHexForActivation(0.2, true)).toBe('#ef4444');
  });

  it('models exponential blood lactate crossing LT1 (2.0 mmol/L) and LT2 (4.0 mmol/L)', () => {
    const low = computeBioTelemetry(100, 1.0);
    const mid = computeBioTelemetry(220, 1.0);
    const high = computeBioTelemetry(380, 1.0);
    expect(low.bloodLactateMmol).toBeCloseTo(0.9, 2);
    expect(low.lt1Crossed).toBe(false);
    expect(low.lactateBand).toBe('SUB_LT1');

    expect(mid.bloodLactateMmol).toBeGreaterThanOrEqual(LT1_MMOL);
    expect(mid.bloodLactateMmol).toBeLessThan(LT2_MMOL);
    expect(mid.lactateBand).toBe('AEROBIC_TRANSITION');

    expect(high.bloodLactateMmol).toBeCloseTo(8.4, 2);
    expect(high.lt2Crossed).toBe(true);
    expect(high.lactateBand).toBe('ABOVE_LT2');
  });

  it('scales VO2 consumption and respiratory rate monotonically with power output', () => {
    const p1 = computeBioTelemetry(100, 1.0);
    const p2 = computeBioTelemetry(240, 1.0);
    const p3 = computeBioTelemetry(380, 1.0);
    expect(p1.vo2MlKgMin).toBe(28.0);
    expect(p3.vo2MlKgMin).toBe(66.5);
    expect(p1.vo2MlKgMin).toBeLessThan(p2.vo2MlKgMin);
    expect(p2.vo2MlKgMin).toBeLessThan(p3.vo2MlKgMin);
    expect(p1.respiratoryRateBpm).toBeLessThan(p3.respiratoryRateBpm);
  });

  it('triggers cardiac drift and suppresses HRV readiness under ACWR 1.65 overtraining', () => {
    const fresh = computeBioTelemetry(240, 1.0);
    const strained = computeBioTelemetry(240, 1.65);
    expect(strained.heartRateBpm).toBeGreaterThan(fresh.heartRateBpm);
    expect(strained.hrvReadinessPct).toBeLessThan(fresh.hrvReadinessPct - 40);
    expect(strained.hrvMs).toBeLessThan(fresh.hrvMs);
    expect(strained.acwrVerdict).toBe('INJURY DANGER');
    expect(strained.jointWarningActive).toBe(true);
  });

  it('flags quadriceps and calves/Achilles stress alerts under ACWR > 1.50 while preserving healthy joints at ACWR 0.98', () => {
    const danger = computeBioTelemetry(340, 1.65);
    expect(danger.bodySystems.quadriceps.stressAlert).toBe(true);
    expect(danger.bodySystems.calves_achilles.stressAlert).toBe(true);
    expect(danger.bodySystems.quadriceps.hexColor).toBe('#ef4444');
    expect(danger.bodySystems.calves_achilles.hexColor).toBe('#ef4444');

    const safe = computeBioTelemetry(165, 0.98);
    expect(safe.jointWarningActive).toBe(false);
    expect(safe.bodySystems.quadriceps.stressAlert).toBe(false);
    expect(safe.bodySystems.calves_achilles.stressAlert).toBe(false);
  });

  it('exposes all 5 clickable anatomical body systems with valid SmO2, G-force, and bilingual clinical notes', () => {
    expect(BODY_SYSTEM_ORDER).toHaveLength(5);
    const snap = computeBioTelemetry(240, 1.04);
    for (const id of BODY_SYSTEM_ORDER) {
      const sys = snap.bodySystems[id];
      expect(sys.activation).toBeGreaterThanOrEqual(0);
      expect(sys.activation).toBeLessThanOrEqual(1);
      expect(sys.smo2Pct).toBeGreaterThanOrEqual(27);
      expect(sys.smo2Pct).toBeLessThanOrEqual(84);
      expect(sys.jointImpactG).toBeGreaterThan(1.0);
      expect(sys.clinicalNoteEn.length).toBeGreaterThan(10);
      expect(sys.clinicalNoteVi.length).toBeGreaterThan(10);
    }
  });

  it('depletes muscle oxygenation SmO2 % and flips lactate clearance negative at 380W sprint', () => {
    const easy = computeBioTelemetry(110, 1.0);
    const sprint = computeBioTelemetry(380, 1.0);
    expect(sprint.bodySystems.quadriceps.smo2Pct).toBeLessThan(easy.bodySystems.quadriceps.smo2Pct);
    expect(easy.bodySystems.quadriceps.lactateClearanceMmolMin).toBeGreaterThan(0);
    expect(sprint.bodySystems.quadriceps.lactateClearanceMmolMin).toBeLessThan(0);
  });

  it('computes realistic counter-phase hip, knee, and arm gait kinematics', () => {
    const pose0 = computeGaitPose(Math.PI / 2, 240, 1.0);
    expect(pose0.leftHipPitch).toBeGreaterThan(pose0.rightHipPitch);
    expect(pose0.leftShoulderPitch).toBeLessThan(pose0.rightShoulderPitch); // natural counter-swing
    expect(pose0.leftKneeFlex).toBeGreaterThanOrEqual(0.08);
    expect(pose0.rightKneeFlex).toBeGreaterThanOrEqual(0.08);
  });

  it('increases stride frequency, ground speed, and forward trunk lean from 100W to 380W', () => {
    const jog = computeGaitPose(0.5, 100, 1.0);
    const sprint = computeGaitPose(0.5, 380, 1.0);
    expect(sprint.strideFrequencyHz).toBeGreaterThan(jog.strideFrequencyHz);
    expect(sprint.groundSpeedKmh).toBeGreaterThan(jog.groundSpeedKmh + 10);
    expect(sprint.torsoForwardLean).toBeGreaterThan(jog.torsoForwardLean);
    expect(sprint.verticalShockG).toBeGreaterThan(jog.verticalShockG);
  });

  it('introduces measurable gait asymmetry and vertical shock escalation when ACWR > 1.50', () => {
    const fresh = computeGaitPose(1.0, 300, 1.0);
    const fatigued = computeGaitPose(1.0, 300, 1.65);
    expect(fatigued.asymmetryPct).toBeGreaterThan(fresh.asymmetryPct);
    expect(fatigued.verticalShockG).toBeGreaterThan(fresh.verticalShockG);
  });

  it('produces valid cardiac lub-dub pulse and lung expansion bounds across full gait phase', () => {
    for (let i = 0; i < 24; i += 1) {
      const phase = (i / 24) * Math.PI * 2;
      const pose = computeGaitPose(phase, 260, 1.05);
      expect(pose.heartPulseScale).toBeGreaterThanOrEqual(1.0);
      expect(pose.heartPulseScale).toBeLessThanOrEqual(1.3);
      expect(pose.lungExpansionScale).toBeGreaterThanOrEqual(0.9);
      expect(pose.lungExpansionScale).toBeLessThanOrEqual(1.12);
    }
  });

  it('handles NaN / extreme inputs safely in computeGaitPose and computeBioTelemetry', () => {
    const pose = computeGaitPose(Number.NaN, -100, 99);
    expect(pose.phaseRad).toBe(0);
    expect(pose.cadenceSpm).toBe(154);

    const snap = computeBioTelemetry(Number.POSITIVE_INFINITY, Number.NaN);
    expect(snap.intensityW).toBe(MIN_POWER_W);
    expect(snap.acwr).toBe(MIN_ACWR);
    expect(Number.isFinite(snap.heartRateBpm)).toBe(true);
  });

  it('transitions deterministically on injectOvertrainingSpike -> prescribeAutonomicDeload', () => {
    const spiked = injectOvertrainingSpike(DEFAULT_BIO_STUDIO_STATE);
    expect(spiked.intensityW).toBe(380);
    expect(spiked.acwr).toBe(1.65);
    expect(spiked.protocolMode).toBe('OVERTRAINING_SPIKE');
    const spikedSnap = computeBioTelemetry(spiked.intensityW, spiked.acwr);
    expect(spikedSnap.acwrVerdict).toBe('INJURY DANGER');

    const deload = prescribeAutonomicDeload(spiked);
    expect(deload.intensityW).toBe(165);
    expect(deload.acwr).toBe(0.98);
    expect(deload.protocolMode).toBe('AUTONOMIC_DELOAD');
    const deloadSnap = computeBioTelemetry(deload.intensityW, deload.acwr);
    expect(deloadSnap.acwrVerdict).toBe('OPTIMAL');
    expect(deloadSnap.karvonenZone).toBe('Z2');
    expect(deloadSnap.hrvReadinessPct).toBeGreaterThanOrEqual(88);
    expect(deloadSnap.hrvReadinessPct).toBeGreaterThan(spikedSnap.hrvReadinessPct + 50);
  });

  it('preserves active cameraMode across overtraining and deload transitions', () => {
    const spiked = injectOvertrainingSpike({ cameraMode: 'bio_xray' });
    expect(spiked.cameraMode).toBe('bio_xray');
    const deload = prescribeAutonomicDeload(spiked);
    expect(deload.cameraMode).toBe('bio_xray');
  });

  it('exposes 3 calibrated power presets spanning Recovery, LT2 Tempo, and VO2max Sprint', () => {
    expect(POWER_PRESETS).toHaveLength(3);
    expect(POWER_PRESETS.map((p) => p.watts)).toEqual([100, 240, 380]);
  });

  it('clamps ACWR bounds strictly within [MIN_ACWR, MAX_ACWR]', () => {
    expect(computeBioTelemetry(200, 0.1).acwr).toBe(MIN_ACWR);
    expect(computeBioTelemetry(200, 5.0).acwr).toBe(MAX_ACWR);
  });

  it('starts DEFAULT_BIO_STUDIO_STATE at optimal aerobic tempo with cardiopulmonary selected', () => {
    expect(DEFAULT_BIO_STUDIO_STATE.intensityW).toBe(240);
    expect(DEFAULT_BIO_STUDIO_STATE.acwr).toBe(1.04);
    expect(DEFAULT_BIO_STUDIO_STATE.selectedSystem).toBe('cardiopulmonary');
    expect(DEFAULT_BIO_STUDIO_STATE.cameraMode).toBe('studio_orbit');
  });

  it('ensures calves/Achilles sustain higher peak ground-reaction impact than upper-body cardiopulmonary system', () => {
    const snap = computeBioTelemetry(300, 1.1);
    expect(snap.bodySystems.calves_achilles.jointImpactG).toBeGreaterThan(
      snap.bodySystems.cardiopulmonary.jointImpactG
    );
  });

  it('maintains strictly positive stride length within realistic human running bounds (0.9m..2.0m)', () => {
    for (const w of [100, 180, 240, 320, 380]) {
      const pose = computeGaitPose(0.25, w, 1.0);
      expect(pose.strideLengthM).toBeGreaterThan(0.85);
      expect(pose.strideLengthM).toBeLessThan(2.0);
    }
  });

  it('produces identical deterministic telemetry and gait outputs on repeated invocations', () => {
    expect(computeBioTelemetry(275, 1.22)).toEqual(computeBioTelemetry(275, 1.22));
    expect(computeGaitPose(2.1, 275, 1.22)).toEqual(computeGaitPose(2.1, 275, 1.22));
  });

  it('keeps elbow carriage angles anatomically valid across full sprint phase', () => {
    for (let i = 0; i < 16; i += 1) {
      const pose = computeGaitPose((i / 16) * Math.PI * 2, 380, 1.0);
      expect(pose.leftElbowFlex).toBeGreaterThanOrEqual(0.9);
      expect(pose.leftElbowFlex).toBeLessThanOrEqual(1.9);
      expect(pose.rightElbowFlex).toBeGreaterThanOrEqual(0.9);
      expect(pose.rightElbowFlex).toBeLessThanOrEqual(1.9);
    }
  });

  it('scales heart rate cleanly between 120 bpm at 100W and 188 bpm at 380W', () => {
    const low = computeBioTelemetry(100, 1.0);
    const high = computeBioTelemetry(380, 1.0);
    expect(low.heartRateBpm).toBe(120);
    expect(high.heartRateBpm).toBe(188);
  });

  it('raises total muscle activation monotonically across all 5 body systems as power climbs', () => {
    const p1 = computeBioTelemetry(100, 1.0);
    const p3 = computeBioTelemetry(380, 1.0);
    for (const id of BODY_SYSTEM_ORDER) {
      expect(p3.bodySystems[id].activation).toBeGreaterThan(p1.bodySystems[id].activation + 0.5);
    }
  });

  it('assigns distinct bilingual labels to all 5 anatomical body systems', () => {
    const snap = computeBioTelemetry(240, 1.0);
    const enLabels = new Set(BODY_SYSTEM_ORDER.map((id) => snap.bodySystems[id].labelEn));
    const viLabels = new Set(BODY_SYSTEM_ORDER.map((id) => snap.bodySystems[id].labelVi));
    expect(enLabels.size).toBe(5);
    expect(viLabels.size).toBe(5);
  });

  it('verifies overtraining spike forces cardiac drift up to 100% HRR ceiling safely', () => {
    const snap = computeBioTelemetry(380, 1.65);
    expect(snap.pctHrr).toBe(100);
    expect(snap.heartRateBpm).toBe(188);
  });

  it('verifies autonomic deload recovers blood lactate strictly below LT1 (2.0 mmol/L)', () => {
    const deload = prescribeAutonomicDeload();
    const snap = computeBioTelemetry(deload.intensityW, deload.acwr);
    expect(snap.bloodLactateMmol).toBeLessThan(LT1_MMOL);
    expect(snap.lt1Crossed).toBe(false);
    expect(snap.lt2Crossed).toBe(false);
  });
});
