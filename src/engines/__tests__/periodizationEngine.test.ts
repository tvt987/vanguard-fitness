import { describe, expect, it } from 'vitest';
import {
  computeWorkingLoadKg,
  DEFAULT_1RM_BY_EXPERIENCE,
  estimate1RmBrzycki,
  estimate1RmEpley,
  exportPeriodizationCsv,
  exportPeriodizationMarkdown,
  generatePeriodizationPlan,
  MAX_SAFE_ACWR,
  type ExperienceLevel,
  type PeriodizationGoal,
  type PeriodizationInput,
  type TrainingDaysPerWeek,
} from '../periodizationEngine';

const BASE_INPUT: PeriodizationInput = {
  goal: 'hypertrophy_volume',
  daysPerWeek: 4,
  experience: 'intermediate',
  oneRepMax: { squatKg: 140, benchKg: 100, deadliftKg: 180 },
};

const ALL_GOALS: PeriodizationGoal[] = [
  'hypertrophy_volume',
  'powerlifting_peaking',
  'hyrox_hybrid',
  'executive_recomp',
];

const ALL_DAYS: TrainingDaysPerWeek[] = [3, 4, 5, 6];
const ALL_EXP: ExperienceLevel[] = ['novice', 'intermediate', 'advanced'];

describe('12-Week Periodized Mesocycle & Workout Split Engine', () => {
  it('computes exact Epley 1RM for single and multi-rep sets', () => {
    expect(estimate1RmEpley(100, 1)).toBe(100);
    // 100 * (1 + 6/30) = 120.0
    expect(estimate1RmEpley(100, 6)).toBe(120);
    // 120 * (1 + 5/30) = 140.0
    expect(estimate1RmEpley(120, 5)).toBe(140);
  });

  it('computes exact Brzycki 1RM and stays aligned with Epley in moderate rep ranges', () => {
    expect(estimate1RmBrzycki(100, 1)).toBe(100);
    // 100 * (36 / (37 - 5)) = 100 * 36/32 = 112.5
    expect(estimate1RmBrzycki(100, 5)).toBe(112.5);
    // 100 * (36 / (37 - 10)) = 133.3
    expect(estimate1RmBrzycki(100, 10)).toBe(133.3);
    expect(Math.abs(estimate1RmEpley(100, 8) - estimate1RmBrzycki(100, 8))).toBeLessThan(3);
  });

  it('rounds prescribed working barbell loads cleanly to 2.5 kg plate increments', () => {
    expect(computeWorkingLoadKg(140, 80)).toBe(112.5);
    expect(computeWorkingLoadKg(100, 75)).toBe(75);
    expect(computeWorkingLoadKg(180, 90)).toBe(162.5);
    expect(computeWorkingLoadKg(140, 80) % 2.5).toBe(0);
  });

  it('always produces exactly 12 weeks mapped across 3 distinct mesocycle phases', () => {
    const plan = generatePeriodizationPlan(BASE_INPUT);
    expect(plan.weeks).toHaveLength(12);
    expect(plan.mesocycles).toHaveLength(3);

    expect(plan.weeks.slice(0, 4).every((w) => w.phase === 'accumulation')).toBe(true);
    expect(plan.weeks.slice(4, 8).every((w) => w.phase === 'intensification')).toBe(true);
    expect(plan.weeks.slice(8, 12).every((w) => w.phase === 'peak_deload')).toBe(true);
    expect(plan.mesocycles.map((m) => m.weeksLabel)).toEqual(['W1–W4', 'W5–W8', 'W9–W12']);
  });

  it('marks strictly weeks 4, 8, and 12 as deload weeks', () => {
    const plan = generatePeriodizationPlan(BASE_INPUT);
    const deloadWeeks = plan.weeks.filter((w) => w.isDeload).map((w) => w.week);
    expect(deloadWeeks).toEqual([4, 8, 12]);
  });

  it('enforces deload volume drop strictly within -35% to -45% on W4, W8, and W12 for every goal', () => {
    for (const goal of ALL_GOALS) {
      const plan = generatePeriodizationPlan({ ...BASE_INPUT, goal });
      expect(plan.deloadDropPcts).toHaveLength(3);
      for (const dropPct of plan.deloadDropPcts) {
        expect(dropPct).toBeLessThanOrEqual(-35);
        expect(dropPct).toBeGreaterThanOrEqual(-45);
      }
    }
  });

  it('enforces deload volume drop within -35% to -45% across all 48 goal x frequency x experience combinations', () => {
    for (const goal of ALL_GOALS) {
      for (const daysPerWeek of ALL_DAYS) {
        for (const experience of ALL_EXP) {
          const plan = generatePeriodizationPlan({
            goal,
            daysPerWeek,
            experience,
            oneRepMax: DEFAULT_1RM_BY_EXPERIENCE[experience],
          });
          for (const dropPct of plan.deloadDropPcts) {
            expect(dropPct).toBeLessThanOrEqual(-35);
            expect(dropPct).toBeGreaterThanOrEqual(-45);
          }
        }
      }
    }
  });

  it('enforces Acute:Chronic Workload Ratio (ACWR <= 1.35) safety cap across all 48 configurations', () => {
    for (const goal of ALL_GOALS) {
      for (const daysPerWeek of ALL_DAYS) {
        for (const experience of ALL_EXP) {
          const plan = generatePeriodizationPlan({
            goal,
            daysPerWeek,
            experience,
            oneRepMax: DEFAULT_1RM_BY_EXPERIENCE[experience],
          });
          expect(plan.peakAcwr).toBeLessThanOrEqual(MAX_SAFE_ACWR);
          for (const week of plan.weeks) {
            expect(week.acwr).toBeLessThanOrEqual(MAX_SAFE_ACWR);
            expect(week.acwr).toBeGreaterThan(0.35);
          }
        }
      }
    }
  });

  it('lowers RPE and relative intensity cleanly during deload weeks compared to preceding peak weeks', () => {
    const plan = generatePeriodizationPlan({ ...BASE_INPUT, goal: 'powerlifting_peaking' });
    for (const deloadIdx of [3, 7, 11]) {
      const deloadWeek = plan.weeks[deloadIdx];
      const prevPeakWeek = plan.weeks[deloadIdx - 1];
      expect(deloadWeek.targetRpe).toBeLessThanOrEqual(6.5);
      expect(deloadWeek.targetRpe).toBeLessThan(prevPeakWeek.targetRpe);
      expect(deloadWeek.relativeIntensityPct).toBeLessThan(prevPeakWeek.relativeIntensityPct);
      expect(deloadWeek.acwrStatus).toBe('deload');
    }
  });

  it('progressively ramps weekly effective sets within Accumulation (W1 -> W3)', () => {
    const plan = generatePeriodizationPlan(BASE_INPUT);
    expect(plan.weeks[1].effectiveSets).toBeGreaterThan(plan.weeks[0].effectiveSets);
    expect(plan.weeks[2].effectiveSets).toBeGreaterThan(plan.weeks[1].effectiveSets);
  });

  it('progressively escalates relative intensity across mesocycles (Accumulation < Intensification < Peak)', () => {
    for (const goal of ALL_GOALS) {
      const plan = generatePeriodizationPlan({ ...BASE_INPUT, goal });
      expect(plan.mesocycles[1].peakIntensityPct).toBeGreaterThan(
        plan.mesocycles[0].peakIntensityPct
      );
      expect(plan.mesocycles[2].peakIntensityPct).toBeGreaterThan(
        plan.mesocycles[1].peakIntensityPct
      );
    }
  });

  it('gives Powerlifting 1RM Peaking higher peak intensity (%1RM) than Hypertrophy Volume', () => {
    const power = generatePeriodizationPlan({ ...BASE_INPUT, goal: 'powerlifting_peaking' });
    const hyper = generatePeriodizationPlan({ ...BASE_INPUT, goal: 'hypertrophy_volume' });
    expect(power.peakIntensityPct).toBeGreaterThanOrEqual(92);
    expect(power.peakIntensityPct).toBeGreaterThan(hyper.peakIntensityPct);
  });

  it('gives Hypertrophy Volume higher weekly effective sets than Powerlifting 1RM Peaking', () => {
    const power = generatePeriodizationPlan({ ...BASE_INPUT, goal: 'powerlifting_peaking' });
    const hyper = generatePeriodizationPlan({ ...BASE_INPUT, goal: 'hypertrophy_volume' });
    expect(hyper.peakWeeklySets).toBeGreaterThan(power.peakWeeklySets);
  });

  it('scales weekly effective sets monotonically across experience levels (Novice < Intermediate < Advanced)', () => {
    const novice = generatePeriodizationPlan({ ...BASE_INPUT, experience: 'novice' });
    const inter = generatePeriodizationPlan({ ...BASE_INPUT, experience: 'intermediate' });
    const adv = generatePeriodizationPlan({ ...BASE_INPUT, experience: 'advanced' });

    expect(inter.peakWeeklySets).toBeGreaterThan(novice.peakWeeklySets);
    expect(adv.peakWeeklySets).toBeGreaterThan(inter.peakWeeklySets);
  });

  it('scales weekly effective sets monotonically across training frequencies (3 < 4 < 5 < 6 days)', () => {
    const peaks = ALL_DAYS.map(
      (daysPerWeek) =>
        generatePeriodizationPlan({ ...BASE_INPUT, daysPerWeek }).peakWeeklySets
    );
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    }
  });

  it('generates exact 3-day Full-Body split with balanced push/pull and lower/upper coverage', () => {
    const plan = generatePeriodizationPlan({ ...BASE_INPUT, daysPerWeek: 3 });
    expect(plan.weeklySplit).toHaveLength(3);
    expect(plan.splitLabelEn).toContain('3-Day');
    expect(plan.muscleGroupWeeklySets.quads).toBeGreaterThan(0);
    expect(plan.muscleGroupWeeklySets.posterior_chain).toBeGreaterThan(0);
    expect(plan.pushToPullRatio).toBeGreaterThanOrEqual(0.7);
    expect(plan.pushToPullRatio).toBeLessThanOrEqual(1.35);
  });

  it('generates exact 4-day Upper / Lower split with balanced push/pull ratio', () => {
    const plan = generatePeriodizationPlan({ ...BASE_INPUT, daysPerWeek: 4 });
    expect(plan.weeklySplit).toHaveLength(4);
    expect(plan.splitLabelEn).toContain('Upper / Lower');
    expect(plan.pushToPullRatio).toBeGreaterThanOrEqual(0.75);
    expect(plan.pushToPullRatio).toBeLessThanOrEqual(1.3);
  });

  it('generates exact 5-day Upper / Lower / Hybrid split with dedicated conditioning volume', () => {
    const plan = generatePeriodizationPlan({
      ...BASE_INPUT,
      goal: 'hyrox_hybrid',
      daysPerWeek: 5,
    });
    expect(plan.weeklySplit).toHaveLength(5);
    expect(plan.muscleGroupWeeklySets.conditioning).toBeGreaterThanOrEqual(6);
    expect(plan.pushToPullRatio).toBeGreaterThanOrEqual(0.75);
    expect(plan.pushToPullRatio).toBeLessThanOrEqual(1.3);
  });

  it('generates exact 6-day Push / Pull / Legs dual-wave split with balanced push/pull', () => {
    const plan = generatePeriodizationPlan({ ...BASE_INPUT, daysPerWeek: 6 });
    expect(plan.weeklySplit).toHaveLength(6);
    expect(plan.splitLabelEn).toContain('Push / Pull / Legs');
    expect(plan.pushToPullRatio).toBeGreaterThanOrEqual(0.75);
    expect(plan.pushToPullRatio).toBeLessThanOrEqual(1.35);
  });

  it('propagates custom Squat / Bench / Deadlift 1RM inputs directly into weekly prescribed loads and split exercises', () => {
    const lighter = generatePeriodizationPlan(
      { ...BASE_INPUT, oneRepMax: { squatKg: 100, benchKg: 80, deadliftKg: 120 } },
      10
    );
    const heavier = generatePeriodizationPlan(
      { ...BASE_INPUT, oneRepMax: { squatKg: 200, benchKg: 140, deadliftKg: 240 } },
      10
    );

    expect(heavier.weeks[9].prescribedLoadsKg.squatKg).toBeGreaterThan(
      lighter.weeks[9].prescribedLoadsKg.squatKg * 1.8
    );
    expect(heavier.weeks[9].prescribedLoadsKg.benchKg).toBeGreaterThan(
      lighter.weeks[9].prescribedLoadsKg.benchKg * 1.6
    );
    expect(heavier.weeks[9].prescribedLoadsKg.deadliftKg).toBeGreaterThan(
      lighter.weeks[9].prescribedLoadsKg.deadliftKg * 1.8
    );

    const lightSquatEx = lighter.weeklySplit[0].exercises.find((e) => e.liftAnchor === 'squat')!;
    const heavySquatEx = heavier.weeklySplit[0].exercises.find((e) => e.liftAnchor === 'squat')!;
    expect(heavySquatEx.targetLoadKg!).toBeGreaterThan(lightSquatEx.targetLoadKg! * 1.8);
  });

  it('reduces split day set counts when inspecting a Deload Week (W4) vs Accumulation Peak (W3)', () => {
    const w3 = generatePeriodizationPlan(BASE_INPUT, 3);
    const w4 = generatePeriodizationPlan(BASE_INPUT, 4);

    const totalSetsW3 = w3.weeklySplit.reduce((s, d) => s + d.totalSets, 0);
    const totalSetsW4 = w4.weeklySplit.reduce((s, d) => s + d.totalSets, 0);
    expect(totalSetsW4).toBeLessThan(totalSetsW3 * 0.78);
  });

  it('clamps out-of-bounds inspectWeek and extreme 1RM values safely without NaN', () => {
    const plan = generatePeriodizationPlan(
      {
        ...BASE_INPUT,
        oneRepMax: { squatKg: 0, benchKg: 999, deadliftKg: -50 },
      },
      99
    );
    expect(plan.inspectedWeek).toBe(12);
    expect(plan.input.oneRepMax.squatKg).toBeGreaterThanOrEqual(30);
    expect(plan.input.oneRepMax.benchKg).toBeLessThanOrEqual(260);
    expect(plan.input.oneRepMax.deadliftKg).toBeGreaterThanOrEqual(40);
    expect(Number.isNaN(plan.peakAcwr)).toBe(false);
  });

  it('is 100% deterministic for identical inputs', () => {
    const a = generatePeriodizationPlan(BASE_INPUT, 7);
    const b = generatePeriodizationPlan(BASE_INPUT, 7);
    expect(a).toEqual(b);
  });

  it('exports valid UTF-8 BOM CSV containing all 12 weeks and weekly split exercises', () => {
    const plan = generatePeriodizationPlan(BASE_INPUT, 6);
    const csv = exportPeriodizationCsv(plan);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('VANGUARD PERFORMANCE CLUB - 12-WEEK PERIODIZED MESOCYCLE PLAN');
    expect(csv).toContain('W1,Accumulation,NO');
    expect(csv).toContain('W4,Accumulation,YES');
    expect(csv).toContain('W12,Peak & Deload,YES');
    expect(csv).toContain('Competition Back Squat');
  });

  it('exports valid UTF-8 BOM Markdown plan with mesocycle table and split breakdown', () => {
    const plan = generatePeriodizationPlan(BASE_INPUT, 6);
    const md = exportPeriodizationMarkdown(plan);
    expect(md.charCodeAt(0)).toBe(0xfeff);
    expect(md).toContain('# VANGUARD PERFORMANCE CLUB');
    expect(md).toContain('## 12-Week Volume vs Intensity Progression Matrix');
    expect(md).toContain('| W4 | Accumulation | DELOAD |');
    expect(md).toContain('| W8 | Intensification | DELOAD |');
    expect(md).toContain('| W12 | Peak & Deload | DELOAD |');
    expect(md).toContain('### Day 1 (MON)');
  });
});
