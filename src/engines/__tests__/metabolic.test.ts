import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MULTIPLIERS,
  calculateMifflinStJeorBmr,
  computeMetabolicProfile,
  exportMetabolicPlanCsv,
  type ActivityLevel,
  type MetabolicInput,
} from '../metabolic';

const BASE_MALE: MetabolicInput = {
  sex: 'male',
  age: 28,
  weightKg: 78,
  heightCm: 178,
  bodyFatPct: 18,
  activity: 'moderate',
  goal: 'fat_loss',
};

describe('Metabolic & 12-Week Transformation Engine', () => {
  it('computes exact Mifflin-St Jeor BMR for males', () => {
    // 10*78 + 6.25*178 - 5*28 + 5 = 780 + 1112.5 - 140 + 5 = 1757.5 -> 1758
    expect(calculateMifflinStJeorBmr('male', 78, 178, 28)).toBe(1758);
  });

  it('computes exact Mifflin-St Jeor BMR for females', () => {
    // 10*58 + 6.25*165 - 5*26 - 161 = 580 + 1031.25 - 130 - 161 = 1320.25 -> 1320
    expect(calculateMifflinStJeorBmr('female', 58, 165, 26)).toBe(1320);
  });

  it('scales TDEE strictly monotonically across all 5 activity multipliers', () => {
    const levels: ActivityLevel[] = [
      'sedentary',
      'light',
      'moderate',
      'athlete',
      'elite',
    ];
    const tdees = levels.map(
      (activity) => computeMetabolicProfile({ ...BASE_MALE, activity }).tdee
    );
    for (let i = 1; i < tdees.length; i++) {
      expect(tdees[i]).toBeGreaterThan(tdees[i - 1]);
    }
    expect(ACTIVITY_MULTIPLIERS.moderate).toBe(1.55);
  });

  it('orders daily caloric targets accurately across goals', () => {
    const fatLoss = computeMetabolicProfile({ ...BASE_MALE, goal: 'fat_loss' });
    const recomp = computeMetabolicProfile({ ...BASE_MALE, goal: 'lean_recomp' });
    const endurance = computeMetabolicProfile({ ...BASE_MALE, goal: 'endurance' });
    const hypertrophy = computeMetabolicProfile({ ...BASE_MALE, goal: 'hypertrophy' });

    expect(fatLoss.targetCalories).toBeLessThan(recomp.targetCalories);
    expect(recomp.targetCalories).toBeLessThan(fatLoss.tdee);
    expect(endurance.targetCalories).toBeGreaterThan(fatLoss.tdee);
    expect(hypertrophy.targetCalories).toBeGreaterThan(endurance.targetCalories);
  });

  it('enforces safe daily caloric floors for small sedentary profiles', () => {
    const smallFemale = computeMetabolicProfile({
      sex: 'female',
      age: 45,
      weightKg: 44,
      heightCm: 150,
      bodyFatPct: 24,
      activity: 'sedentary',
      goal: 'fat_loss',
    });
    const smallMale = computeMetabolicProfile({
      sex: 'male',
      age: 50,
      weightKg: 52,
      heightCm: 160,
      bodyFatPct: 16,
      activity: 'sedentary',
      goal: 'fat_loss',
    });
    expect(smallFemale.targetCalories).toBeGreaterThanOrEqual(1200);
    expect(smallMale.targetCalories).toBeGreaterThanOrEqual(1500);
  });

  it('produces consistent macro gram splits summing to 100% with goal-specific carbs', () => {
    const fatLoss = computeMetabolicProfile({ ...BASE_MALE, goal: 'fat_loss' });
    const endurance = computeMetabolicProfile({ ...BASE_MALE, goal: 'endurance' });

    expect(
      fatLoss.macros.proteinPct + fatLoss.macros.carbsPct + fatLoss.macros.fatPct
    ).toBe(100);
    expect(endurance.macros.carbsG).toBeGreaterThan(fatLoss.macros.carbsG);
    expect(fatLoss.macros.proteinG).toBeGreaterThanOrEqual(140);
  });

  it('scales daily hydration liters and sodium electrolytes by activity level', () => {
    const sedentary = computeMetabolicProfile({ ...BASE_MALE, activity: 'sedentary' });
    const elite = computeMetabolicProfile({ ...BASE_MALE, activity: 'elite' });

    expect(elite.hydrationLiters).toBeGreaterThan(sedentary.hydrationLiters);
    expect(elite.electrolyteSodiumMg).toBeGreaterThan(sedentary.electrolyteSodiumMg);
    expect(sedentary.hydrationLiters).toBeGreaterThan(2.5);
  });

  it('generates a 13-point trajectory (Week 0 to Week 12) anchored at start metrics', () => {
    const res = computeMetabolicProfile(BASE_MALE);
    expect(res.trajectory).toHaveLength(13);
    expect(res.trajectory[0].week).toBe(0);
    expect(res.trajectory[12].week).toBe(12);
    expect(res.trajectory[0].weightKg).toBe(78);
    expect(res.trajectory[0].bodyFatPct).toBe(18);
  });

  it('models distinct physiological outcomes across Fat Loss, Recomp, and Hypertrophy', () => {
    const fatLoss = computeMetabolicProfile({ ...BASE_MALE, goal: 'fat_loss' });
    const recomp = computeMetabolicProfile({ ...BASE_MALE, goal: 'lean_recomp' });
    const hypertrophy = computeMetabolicProfile({ ...BASE_MALE, goal: 'hypertrophy' });

    // Fat loss: weight and fat mass decrease clearly, lean mass preserved
    expect(fatLoss.summary12Week.weightDeltaKg).toBeLessThan(-3);
    expect(fatLoss.summary12Week.bodyFatDeltaPct).toBeLessThan(-3);
    expect(fatLoss.summary12Week.leanMassDeltaKg).toBeGreaterThanOrEqual(0);

    // Recomp: simultaneous lean gain and body fat percentage reduction
    expect(recomp.summary12Week.leanMassDeltaKg).toBeGreaterThan(1);
    expect(recomp.summary12Week.bodyFatDeltaPct).toBeLessThan(-2);

    // Hypertrophy: clear total weight & lean mass increase
    expect(hypertrophy.summary12Week.weightDeltaKg).toBeGreaterThan(2);
    expect(hypertrophy.summary12Week.leanMassDeltaKg).toBeGreaterThan(1.5);
  });

  it('exports UTF-8 BOM CSV containing profile metrics and all 13 weekly rows', () => {
    const res = computeMetabolicProfile(BASE_MALE);
    const csv = exportMetabolicPlanCsv(BASE_MALE, res);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('VANGUARD BIO-PERFORMANCE CLUB');
    expect(csv).toContain('Week,Weight (kg),Lean Mass (kg)');
    expect(csv).toContain('\r\n12,');
  });
});
