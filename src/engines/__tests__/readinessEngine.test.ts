import { describe, expect, it } from 'vitest';
import {
  classifyAcwrBand,
  computeLactateAtPctHrr,
  computeReadinessZones,
  computeTanakaMaxHr,
  computeUthSorensenVo2Max,
  computeVo2Percentile,
  DEFAULT_READINESS_INPUT,
  exportReadinessCsv,
  READINESS_PRESETS,
  type AthleteTier,
} from '../readinessEngine';

describe('readinessEngine — Karvonen HR Reserve, Lactate Curve & HRV/ACWR Readiness', () => {
  it('computes exact Tanaka Max HR (208 - 0.7 * age) across adult ages', () => {
    expect(computeTanakaMaxHr(20)).toBe(194);
    expect(computeTanakaMaxHr(31)).toBe(186); // 208 - 21.7 = 186.3 -> 186
    expect(computeTanakaMaxHr(40)).toBe(180);
    expect(computeTanakaMaxHr(60)).toBe(166);
  });

  it('clamps age and resting HR to physiological bounds when out of range', () => {
    const low = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 10,
      restingHr: 25,
    });
    expect(low.age).toBe(18);
    expect(low.restingHr).toBe(38);

    const high = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 99,
      restingHr: 120,
    });
    expect(high.age).toBe(75);
    expect(high.restingHr).toBe(90);
  });

  it('uses auto Tanaka Max HR when customMaxHr is null and respects custom override', () => {
    const auto = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 30,
      customMaxHr: null,
    });
    expect(auto.maxHr).toBe(187);
    expect(auto.maxHrSource).toBe('tanaka_auto');

    const custom = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 30,
      customMaxHr: 196,
    });
    expect(custom.maxHr).toBe(196);
    expect(custom.maxHrSource).toBe('custom_override');
    expect(custom.heartRateReserve).toBe(196 - 52);
  });

  it('produces 5 Karvonen HRR zones with strictly monotonic non-overlapping BPM bands', () => {
    const res = computeReadinessZones(DEFAULT_READINESS_INPUT);
    expect(res.zones).toHaveLength(5);
    expect(res.zones.map((z) => z.code)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);

    for (let i = 0; i < res.zones.length; i++) {
      const z = res.zones[i];
      expect(z.minBpm).toBeLessThan(z.maxBpm);
      expect(z.minBpm).toBeGreaterThan(res.restingHr);
      expect(z.maxBpm).toBeLessThanOrEqual(res.maxHr);
      if (i > 0) {
        expect(z.minBpm).toBe(res.zones[i - 1].maxBpm + 1);
        expect(z.maxBpm).toBeGreaterThan(res.zones[i - 1].maxBpm);
      }
    }
    expect(res.zones[4].maxBpm).toBe(res.maxHr);
  });

  it('calculates exact Karvonen BPM thresholds (RHR + % * HRR)', () => {
    // Age 40 -> MaxHR 180, RHR 60 -> HRR = 120
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 40,
      restingHr: 60,
      customMaxHr: null,
    });
    expect(res.heartRateReserve).toBe(120);
    // Z1: 50-60% -> 60 + 60 = 120 to 60 + 72 = 132
    expect(res.zones[0].minBpm).toBe(120);
    expect(res.zones[0].maxBpm).toBe(132);
    // Z2: 60-70% -> 133 to 144
    expect(res.zones[1].minBpm).toBe(133);
    expect(res.zones[1].maxBpm).toBe(144);
    // Z3: 70-80% -> 145 to 156
    expect(res.zones[2].minBpm).toBe(145);
    expect(res.zones[2].maxBpm).toBe(156);
    // Z4: 80-90% -> 157 to 168
    expect(res.zones[3].minBpm).toBe(157);
    expect(res.zones[3].maxBpm).toBe(168);
    // Z5: 90-100% -> 169 to 180
    expect(res.zones[4].minBpm).toBe(169);
    expect(res.zones[4].maxBpm).toBe(180);
  });

  it('maintains Karvonen monotonicity even at narrow HR reserve floor', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 75,
      restingHr: 90,
      customMaxHr: 130,
    });
    expect(res.heartRateReserve).toBe(40);
    for (let i = 0; i < 5; i++) {
      expect(res.zones[i].minBpm).toBeLessThan(res.zones[i].maxBpm);
      if (i > 0) {
        expect(res.zones[i].minBpm).toBeGreaterThan(res.zones[i - 1].maxBpm);
      }
    }
  });

  it('computes exact Uth-Sorensen VO2 Max (15.3 * MaxHR / RestingHR)', () => {
    expect(computeUthSorensenVo2Max(186, 52)).toBe(54.7);
    expect(computeUthSorensenVo2Max(190, 42)).toBe(69.2);
    expect(computeUthSorensenVo2Max(180, 60)).toBe(45.9);
  });

  it('ranks lower Resting HR strictly higher in VO2 Max and percentile at fixed age', () => {
    const elite = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 30,
      restingHr: 42,
    });
    const executive = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      age: 30,
      restingHr: 74,
    });
    expect(elite.vo2MaxMlKgMin).toBeGreaterThan(executive.vo2MaxMlKgMin);
    expect(elite.vo2Percentile).toBeGreaterThan(executive.vo2Percentile);
    expect(elite.vo2Rating).toBe('Superior');
  });

  it('adjusts VO2 percentile upward with age for identical absolute VO2 Max', () => {
    const young = computeVo2Percentile(44.0, 22);
    const master = computeVo2Percentile(44.0, 58);
    expect(master.percentile).toBeGreaterThan(young.percentile);
  });

  it('enforces exact 80/20 Polarized weekly minute split across all 3 athlete tiers', () => {
    const tiers: Array<[AthleteTier, number]> = [
      ['executive_wellness', 240],
      ['hybrid_competitor', 360],
      ['marathon_elite', 540],
    ];

    for (const [tier, expectedTotal] of tiers) {
      const res = computeReadinessZones({
        ...DEFAULT_READINESS_INPUT,
        athleteTier: tier,
      });
      expect(res.polarizedSplit.totalWeeklyMinutes).toBe(expectedTotal);
      expect(res.polarizedSplit.lowIntensityPct).toBe(80);
      expect(res.polarizedSplit.highIntensityPct).toBe(20);
      expect(res.polarizedSplit.lowIntensityMinutes).toBe(expectedTotal * 0.8);
      expect(res.polarizedSplit.moderateAndHighMinutes).toBe(expectedTotal * 0.2);

      const zoneSum = res.zones.reduce((sum, z) => sum + z.weeklyMinutes, 0);
      expect(zoneSum).toBe(expectedTotal);
    }
  });

  it('hits exact LT1 = 2.00 mmol/L and LT2 = 4.00 mmol/L on the blood lactate curve for all tiers', () => {
    const tiers: AthleteTier[] = [
      'executive_wellness',
      'hybrid_competitor',
      'marathon_elite',
    ];

    for (const tier of tiers) {
      const res = computeReadinessZones({
        ...DEFAULT_READINESS_INPUT,
        athleteTier: tier,
      });
      expect(res.lt1.lactateMmol).toBe(2.0);
      expect(res.lt2.lactateMmol).toBe(4.0);
      expect(computeLactateAtPctHrr(res.lt1.pctHrr, tier)).toBe(2.0);
      expect(computeLactateAtPctHrr(res.lt2.pctHrr, tier)).toBe(4.0);
      expect(res.lt2.bpm).toBeGreaterThan(res.lt1.bpm);
    }
  });

  it('shifts LT1 and LT2 rightward (% HRR and BPM) as athlete tier increases', () => {
    const exec = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      athleteTier: 'executive_wellness',
    });
    const hybrid = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      athleteTier: 'hybrid_competitor',
    });
    const elite = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      athleteTier: 'marathon_elite',
    });

    expect(elite.lt1.pctHrr).toBeGreaterThan(hybrid.lt1.pctHrr);
    expect(hybrid.lt1.pctHrr).toBeGreaterThan(exec.lt1.pctHrr);
    expect(elite.lt2.pctHrr).toBeGreaterThan(hybrid.lt2.pctHrr);
    expect(hybrid.lt2.pctHrr).toBeGreaterThan(exec.lt2.pctHrr);
    expect(elite.lt2.bpm).toBeGreaterThan(exec.lt2.bpm);
  });

  it('produces a strictly monotonically increasing 12-point blood lactate curve from 45% to 100% HRR', () => {
    const res = computeReadinessZones(DEFAULT_READINESS_INPUT);
    expect(res.lactateCurve).toHaveLength(12);
    expect(res.lactateCurve[0].pctHrr).toBe(45);
    expect(res.lactateCurve[11].pctHrr).toBe(100);

    for (let i = 1; i < res.lactateCurve.length; i++) {
      expect(res.lactateCurve[i].lactateMmol).toBeGreaterThan(
        res.lactateCurve[i - 1].lactateMmol
      );
      expect(res.lactateCurve[i].bpm).toBeGreaterThan(
        res.lactateCurve[i - 1].bpm
      );
    }
  });

  it('demonstrates exponential lactate inflection (slope above LT2 exceeds slope below LT1)', () => {
    const lowSlope =
      computeLactateAtPctHrr(65, 'hybrid_competitor') -
      computeLactateAtPctHrr(55, 'hybrid_competitor');
    const highSlope =
      computeLactateAtPctHrr(95, 'hybrid_competitor') -
      computeLactateAtPctHrr(85, 'hybrid_competitor');
    expect(highSlope).toBeGreaterThan(lowSlope * 3);
  });

  it('classifies all 4 ACWR injury-risk bands accurately at exact boundaries', () => {
    expect(classifyAcwrBand(0.79).band).toBe('undertrained');
    expect(classifyAcwrBand(0.8).band).toBe('optimal');
    expect(classifyAcwrBand(1.08).band).toBe('optimal');
    expect(classifyAcwrBand(1.3).band).toBe('optimal');
    expect(classifyAcwrBand(1.31).band).toBe('caution');
    expect(classifyAcwrBand(1.5).band).toBe('caution');
    expect(classifyAcwrBand(1.51).band).toBe('high_injury_risk');
  });

  it('computes exact ACWR ratio from Acute / Chronic workload AU', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      acuteLoadAu: 2400,
      chronicLoadAu: 2000,
    });
    expect(res.acwr).toBe(1.2);
    expect(res.acwrBand).toBe('optimal');
  });

  it('computes exact HRV Z-Delta % for positive, neutral, and suppressed states', () => {
    const fresh = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 92,
      hrvBaselineMs: 80,
    });
    expect(fresh.hrvDeltaPct).toBe(15);

    const flat = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 80,
      hrvBaselineMs: 80,
    });
    expect(flat.hrvDeltaPct).toBe(0);

    const fatigued = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 60,
      hrvBaselineMs: 80,
    });
    expect(fatigued.hrvDeltaPct).toBe(-25);
  });

  it('triggers RED Recover prescription when ACWR exceeds 1.50 injury threshold', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 86,
      hrvBaselineMs: 76,
      sleepHours: 8.2,
      acuteLoadAu: 3200,
      chronicLoadAu: 2000, // ACWR = 1.60 -> High Injury Risk
      subjectiveReadiness: 9,
    });
    expect(res.acwr).toBe(1.6);
    expect(res.acwrBand).toBe('high_injury_risk');
    expect(res.compositeReadinessScore).toBeLessThanOrEqual(44);
    expect(res.readinessTier).toBe('RED');
    expect(res.prescription.code).toBe('RECOVER_RESTORATIVE');
    expect(res.prescription.volumeModifierPct).toBe(35);
  });

  it('triggers RED Recover prescription when HRV collapses <= -22% below 28-day baseline', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 58,
      hrvBaselineMs: 80, // -27.5%
      sleepHours: 7.8,
      acuteLoadAu: 2000,
      chronicLoadAu: 2000,
      subjectiveReadiness: 7,
    });
    expect(res.hrvDeltaPct).toBe(-27.5);
    expect(res.compositeReadinessScore).toBeLessThanOrEqual(44);
    expect(res.readinessTier).toBe('RED');
  });

  it('caps readiness to AMBER when ACWR is in Caution band (1.31-1.50)', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 85,
      hrvBaselineMs: 76,
      sleepHours: 8.0,
      acuteLoadAu: 2800,
      chronicLoadAu: 2000, // ACWR = 1.40
      subjectiveReadiness: 8,
    });
    expect(res.acwrBand).toBe('caution');
    expect(res.compositeReadinessScore).toBeLessThanOrEqual(68);
    expect(res.readinessTier).toBe('AMBER');
    expect(res.prescription.code).toBe('MODIFY_AEROBIC');
    expect(res.prescription.volumeModifierPct).toBe(70);
  });

  it('caps readiness below GREEN when sleep is critically restricted (<5.5 hrs)', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 86,
      hrvBaselineMs: 76,
      sleepHours: 4.8,
      acuteLoadAu: 2000,
      chronicLoadAu: 2000,
      subjectiveReadiness: 8,
    });
    expect(res.compositeReadinessScore).toBeLessThanOrEqual(68);
    expect(res.readinessTier).toBe('AMBER');
  });

  it('awards GREEN Peak Output prescription when HRV, sleep, ACWR & subjective readiness align', () => {
    const res = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 90,
      hrvBaselineMs: 76,
      sleepHours: 8.2,
      acuteLoadAu: 2050,
      chronicLoadAu: 2000,
      subjectiveReadiness: 9,
    });
    expect(res.compositeReadinessScore).toBeGreaterThanOrEqual(85);
    expect(res.readinessTier).toBe('GREEN');
    expect(res.prescription.code).toBe('PEAK_OUTPUT');
    expect(res.prescription.volumeModifierPct).toBe(100);
  });

  it('keeps composite readiness score strictly within [0, 100] across extreme combinations', () => {
    const maxState = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 180,
      hrvBaselineMs: 50,
      sleepHours: 8.5,
      acuteLoadAu: 2100,
      chronicLoadAu: 2000,
      subjectiveReadiness: 10,
    });
    const minState = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      hrvTodayMs: 15,
      hrvBaselineMs: 140,
      sleepHours: 4.0,
      acuteLoadAu: 5500,
      chronicLoadAu: 1500,
      subjectiveReadiness: 1,
    });
    expect(maxState.compositeReadinessScore).toBeLessThanOrEqual(100);
    expect(maxState.compositeReadinessScore).toBeGreaterThanOrEqual(90);
    expect(minState.compositeReadinessScore).toBeGreaterThanOrEqual(0);
    expect(minState.compositeReadinessScore).toBeLessThanOrEqual(30);
  });

  it('increases composite readiness when sleep improves from 5.5 hrs to 8.0 hrs', () => {
    const shortSleep = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      sleepHours: 5.5,
    });
    const fullSleep = computeReadinessZones({
      ...DEFAULT_READINESS_INPUT,
      sleepHours: 8.0,
    });
    expect(fullSleep.compositeReadinessScore).toBeGreaterThan(
      shortSleep.compositeReadinessScore
    );
  });

  it('maps the 3 built-in Athlete Presets deterministically to GREEN, AMBER, and RED', () => {
    expect(READINESS_PRESETS).toHaveLength(3);

    const taper = computeReadinessZones(READINESS_PRESETS[0].input);
    const jetlag = computeReadinessZones(READINESS_PRESETS[1].input);
    const redAlert = computeReadinessZones(READINESS_PRESETS[2].input);

    expect(taper.readinessTier).toBe('GREEN');
    expect(taper.acwrBand).toBe('optimal');
    expect(taper.vo2MaxMlKgMin).toBeGreaterThan(60);

    expect(jetlag.readinessTier).toBe('AMBER');
    expect(jetlag.hrvDeltaPct).toBeLessThan(-10);

    expect(redAlert.readinessTier).toBe('RED');
    expect(redAlert.acwrBand).toBe('high_injury_risk');
    expect(redAlert.acwr).toBeGreaterThan(1.5);
  });

  it('generates a 7-day HRV & ACWR telemetry series anchored cleanly on Today', () => {
    const res = computeReadinessZones(DEFAULT_READINESS_INPUT);
    expect(res.telemetry7Day).toHaveLength(7);
    expect(res.telemetry7Day[0].dayLabel).toBe('D-6');
    const today = res.telemetry7Day[6];
    expect(today.dayLabel).toBe('Today');
    expect(today.hrvMs).toBe(res.hrvTodayMs);
    expect(today.acwr).toBe(res.acwr);
    expect(today.readinessEst).toBe(res.compositeReadinessScore);
  });

  it('exports UTF-8 BOM CSV containing all 5 Karvonen zones, VO2 Max, LT1/LT2 & ACWR summary', () => {
    const res = computeReadinessZones(DEFAULT_READINESS_INPUT);
    const csv = exportReadinessCsv(res);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Zone,Name,Pct_HRR_Range,BPM_Range');
    expect(csv).toContain('Z1,');
    expect(csv).toContain('Z5,');
    expect(csv).toContain(`VO2Max_mL_kg_min,${res.vo2MaxMlKgMin}`);
    expect(csv).toContain(`LT1_2mmol_BPM,${res.lt1.bpm}`);
    expect(csv).toContain(`LT2_4mmol_BPM,${res.lt2.bpm}`);
    expect(csv).toContain(`ACWR,${res.acwr}`);
  });
});
