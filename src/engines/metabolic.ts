export type BiologicalSex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'athlete'
  | 'elite';

export type TrainingGoal =
  | 'fat_loss'
  | 'lean_recomp'
  | 'hypertrophy'
  | 'endurance';

export interface MetabolicInput {
  sex: BiologicalSex;
  age: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number;
  activity: ActivityLevel;
  goal: TrainingGoal;
}

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface WeeklyProjectionPoint {
  week: number;
  weightKg: number;
  leanMassKg: number;
  fatMassKg: number;
  bodyFatPct: number;
  projectedTdee: number;
}

export interface WeeklyProtocol {
  strengthSessions: number;
  hiitSessions: number;
  pilatesMobility: number;
  cryoRecovery: number;
  dailySteps: number;
}

export interface MetabolicResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  dailyDeltaKcal: number;
  macros: MacroSplit;
  hydrationLiters: number;
  electrolyteSodiumMg: number;
  leanMassKg: number;
  fatMassKg: number;
  readinessScore: number;
  weeklyProtocol: WeeklyProtocol;
  trajectory: WeeklyProjectionPoint[];
  summary12Week: {
    weightDeltaKg: number;
    leanMassDeltaKg: number;
    fatMassDeltaKg: number;
    bodyFatDeltaPct: number;
  };
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  athlete: 1.725,
  elite: 1.9,
};

const ACTIVITY_HYDRATION_BONUS_L: Record<ActivityLevel, number> = {
  sedentary: 0.2,
  light: 0.45,
  moderate: 0.75,
  athlete: 1.1,
  elite: 1.45,
};

const ACTIVITY_SODIUM_BONUS_MG: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 350,
  moderate: 700,
  athlete: 1150,
  elite: 1600,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Exact Mifflin-St Jeor Resting Metabolic Rate equation.
 */
export function calculateMifflinStJeorBmr(
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/**
 * Computes macro gram and calorie breakdown grounded in sports nutrition guidelines.
 */
export function calculateMacroSplit(
  targetCalories: number,
  weightKg: number,
  bodyFatPct: number,
  goal: TrainingGoal
): MacroSplit {
  // Use lean-mass adjusted reference weight when body fat is elevated
  const leanFactor = bodyFatPct > 28 ? 1 - (bodyFatPct - 28) * 0.01 : 1;
  const refWeight = weightKg * clamp(leanFactor, 0.78, 1);

  const proteinPerKg: Record<TrainingGoal, number> = {
    fat_loss: 2.2,
    lean_recomp: 2.25,
    hypertrophy: 2.0,
    endurance: 1.75,
  };

  const fatShareTarget: Record<TrainingGoal, number> = {
    fat_loss: 0.26,
    lean_recomp: 0.27,
    hypertrophy: 0.25,
    endurance: 0.22,
  };

  // Cap protein so it stays within realistic 44% caloric ceiling
  const rawProteinG = Math.round(refWeight * proteinPerKg[goal]);
  const maxProteinG = Math.floor((targetCalories * 0.44) / 4);
  const proteinG = Math.min(rawProteinG, maxProteinG);
  const proteinKcal = proteinG * 4;

  const minFatG = Math.round(refWeight * 0.65);
  let fatG = Math.max(
    minFatG,
    Math.round((targetCalories * fatShareTarget[goal]) / 9)
  );
  let fatKcal = fatG * 9;

  // Ensure carbohydrate floor of 65g for CNS & training glycogen
  const minCarbsG = goal === 'endurance' ? 160 : 65;
  let remainingKcal = targetCalories - proteinKcal - fatKcal;
  if (remainingKcal < minCarbsG * 4) {
    const neededKcal = minCarbsG * 4 - remainingKcal;
    const fatReductionG = Math.ceil(neededKcal / 9);
    fatG = Math.max(35, fatG - fatReductionG);
    fatKcal = fatG * 9;
    remainingKcal = Math.max(minCarbsG * 4, targetCalories - proteinKcal - fatKcal);
  }

  const carbsG = Math.max(minCarbsG, Math.round(remainingKcal / 4));
  const carbsKcal = carbsG * 4;

  const macroTotalKcal = proteinKcal + carbsKcal + fatKcal;
  const proteinPct = Math.round((proteinKcal / macroTotalKcal) * 100);
  const fatPct = Math.round((fatKcal / macroTotalKcal) * 100);
  const carbsPct = Math.max(0, 100 - proteinPct - fatPct);

  return {
    proteinG,
    carbsG,
    fatG,
    proteinKcal,
    carbsKcal,
    fatKcal,
    proteinPct,
    carbsPct,
    fatPct,
  };
}

/**
 * Generates a physiologically grounded 12-week transformation trajectory (Week 0 -> Week 12)
 * factoring adaptive thermogenesis and high-protein resistance training lean-mass dynamics.
 */
export function generateTransformationCurve(
  input: MetabolicInput,
  tdee: number,
  targetCalories: number
): WeeklyProjectionPoint[] {
  const initialWeight = input.weightKg;
  const initialFat = initialWeight * (input.bodyFatPct / 100);
  const initialLean = initialWeight - initialFat;
  const dailyDelta = targetCalories - tdee;
  const points: WeeklyProjectionPoint[] = [];

  let currentLean = initialLean;
  let currentFat = initialFat;
  const minBodyFat = input.sex === 'male' ? 6.5 : 13.5;

  for (let week = 0; week <= 12; week++) {
    if (week > 0) {
      // Adaptive dampening over 12 weeks (metabolic efficiency increases subtly)
      const adaptFactor = 1 - 0.014 * (week - 1);

      if (input.goal === 'fat_loss') {
        const weeklyDeficitKcal = Math.abs(Math.min(0, dailyDelta)) * 7 * adaptFactor;
        const fatLossKg = weeklyDeficitKcal / 7700;
        // High protein + heavy resistance protocol preserves lean tissue and adds slight neural/structural tone
        const leanDeltaKg = 0.02 * adaptFactor;
        currentFat = Math.max(
          (currentLean * minBodyFat) / (100 - minBodyFat),
          currentFat - fatLossKg
        );
        currentLean = currentLean + leanDeltaKg;
      } else if (input.goal === 'lean_recomp') {
        // Simultaneous fat oxidation & lean hypertrophy with high-protein slight deficit
        const fatLossKg = 0.24 * adaptFactor;
        const leanGainKg = (input.sex === 'male' ? 0.16 : 0.11) * adaptFactor;
        currentFat = Math.max(
          (currentLean * minBodyFat) / (100 - minBodyFat),
          currentFat - fatLossKg
        );
        currentLean = currentLean + leanGainKg;
      } else if (input.goal === 'hypertrophy') {
        const weeklySurplusKcal = Math.max(150, dailyDelta) * 7 * adaptFactor;
        // Lean bulk partitioning ~68% lean tissue accretion, ~32% adipose storage
        const maxWeeklyLean = input.sex === 'male' ? 0.23 : 0.15;
        const leanGainKg = Math.min(maxWeeklyLean, (weeklySurplusKcal * 0.65) / 5500);
        const fatGainKg = Math.max(0.04, (weeklySurplusKcal * 0.35) / 7700);
        currentLean = currentLean + leanGainKg;
        currentFat = currentFat + fatGainKg;
      } else {
        // Endurance: aerobic efficiency trims excess fat while reinforcing slow-twitch lean mass
        const leanGainKg = 0.07 * adaptFactor;
        const fatLossKg = 0.13 * adaptFactor;
        currentLean = currentLean + leanGainKg;
        currentFat = Math.max(
          (currentLean * minBodyFat) / (100 - minBodyFat),
          currentFat - fatLossKg
        );
      }
    }

    const totalWeight = currentLean + currentFat;
    const bfPct = (currentFat / totalWeight) * 100;
    const projectedBmr = calculateMifflinStJeorBmr(
      input.sex,
      totalWeight,
      input.heightCm,
      input.age
    );
    const projectedTdee = Math.round(
      projectedBmr * ACTIVITY_MULTIPLIERS[input.activity]
    );

    points.push({
      week,
      weightKg: round1(totalWeight),
      leanMassKg: round1(currentLean),
      fatMassKg: round1(currentFat),
      bodyFatPct: round1(bfPct),
      projectedTdee,
    });
  }

  return points;
}

export function getWeeklyProtocol(goal: TrainingGoal): WeeklyProtocol {
  switch (goal) {
    case 'fat_loss':
      return {
        strengthSessions: 3,
        hiitSessions: 2,
        pilatesMobility: 2,
        cryoRecovery: 2,
        dailySteps: 10500,
      };
    case 'lean_recomp':
      return {
        strengthSessions: 4,
        hiitSessions: 1,
        pilatesMobility: 2,
        cryoRecovery: 2,
        dailySteps: 9000,
      };
    case 'hypertrophy':
      return {
        strengthSessions: 5,
        hiitSessions: 1,
        pilatesMobility: 1,
        cryoRecovery: 2,
        dailySteps: 7500,
      };
    case 'endurance':
      return {
        strengthSessions: 2,
        hiitSessions: 3,
        pilatesMobility: 2,
        cryoRecovery: 3,
        dailySteps: 12000,
      };
  }
}

export function computeMetabolicProfile(rawInput: MetabolicInput): MetabolicResult {
  const input: MetabolicInput = {
    sex: rawInput.sex,
    age: clamp(Math.round(rawInput.age), 16, 85),
    weightKg: clamp(rawInput.weightKg, 38, 180),
    heightCm: clamp(rawInput.heightCm, 140, 220),
    bodyFatPct: clamp(rawInput.bodyFatPct, 5, 50),
    activity: rawInput.activity,
    goal: rawInput.goal,
  };

  const bmr = calculateMifflinStJeorBmr(
    input.sex,
    input.weightKg,
    input.heightCm,
    input.age
  );
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activity]);
  const floorKcal = input.sex === 'male' ? 1500 : 1200;

  let rawTarget = tdee;
  if (input.goal === 'fat_loss') {
    const deficit = clamp(Math.round(tdee * 0.18), 350, 620);
    rawTarget = tdee - deficit;
  } else if (input.goal === 'lean_recomp') {
    rawTarget = Math.round(tdee * 0.95);
  } else if (input.goal === 'hypertrophy') {
    const surplus = clamp(Math.round(tdee * 0.12), 220, 390);
    rawTarget = tdee + surplus;
  } else {
    const surplus = clamp(Math.round(tdee * 0.07), 150, 280);
    rawTarget = tdee + surplus;
  }

  const targetCalories = Math.max(floorKcal, rawTarget);
  const dailyDeltaKcal = targetCalories - tdee;
  const macros = calculateMacroSplit(
    targetCalories,
    input.weightKg,
    input.bodyFatPct,
    input.goal
  );

  const goalHydrationBonus = input.goal === 'endurance' ? 0.35 : input.goal === 'fat_loss' ? 0.2 : 0.1;
  const hydrationLiters = round1(
    input.weightKg * 0.035 + ACTIVITY_HYDRATION_BONUS_L[input.activity] + goalHydrationBonus
  );
  const electrolyteSodiumMg =
    2300 + ACTIVITY_SODIUM_BONUS_MG[input.activity] + (input.goal === 'endurance' ? 400 : 0);

  const fatMassKg = round1(input.weightKg * (input.bodyFatPct / 100));
  const leanMassKg = round1(input.weightKg - fatMassKg);

  const trajectory = generateTransformationCurve(input, tdee, targetCalories);
  const start = trajectory[0];
  const end = trajectory[trajectory.length - 1];

  // Derived readiness telemetry index (78-96%)
  const readinessBase =
    input.activity === 'elite' ? 92 : input.activity === 'athlete' ? 89 : input.activity === 'moderate' ? 86 : 82;
  const readinessScore = clamp(
    readinessBase + (input.goal === 'fat_loss' ? -2 : input.goal === 'lean_recomp' ? 3 : 2),
    74,
    97
  );

  return {
    bmr,
    tdee,
    targetCalories,
    dailyDeltaKcal,
    macros,
    hydrationLiters,
    electrolyteSodiumMg,
    leanMassKg,
    fatMassKg,
    readinessScore,
    weeklyProtocol: getWeeklyProtocol(input.goal),
    trajectory,
    summary12Week: {
      weightDeltaKg: round1(end.weightKg - start.weightKg),
      leanMassDeltaKg: round1(end.leanMassKg - start.leanMassKg),
      fatMassDeltaKg: round1(end.fatMassKg - start.fatMassKg),
      bodyFatDeltaPct: round1(end.bodyFatPct - start.bodyFatPct),
    },
  };
}

/**
 * Exports the metabolic blueprint and 12-week transformation table as UTF-8 BOM CSV.
 */
export function exportMetabolicPlanCsv(
  input: MetabolicInput,
  result: MetabolicResult
): string {
  const lines: string[] = [
    'VANGUARD BIO-PERFORMANCE CLUB - 12-WEEK METABOLIC BLUEPRINT',
    `Profile,Sex: ${input.sex.toUpperCase()},Age: ${input.age},Height: ${input.heightCm}cm,Start Weight: ${input.weightKg}kg,Body Fat: ${input.bodyFatPct}%`,
    `Targets,BMR: ${result.bmr} kcal,TDEE: ${result.tdee} kcal,Daily Target: ${result.targetCalories} kcal,Hydration: ${result.hydrationLiters} L/day`,
    `Macros,Protein: ${result.macros.proteinG}g (${result.macros.proteinPct}%),Carbs: ${result.macros.carbsG}g (${result.macros.carbsPct}%),Fat: ${result.macros.fatG}g (${result.macros.fatPct}%)`,
    '',
    'Week,Weight (kg),Lean Mass (kg),Fat Mass (kg),Body Fat (%),Projected TDEE (kcal)',
    ...result.trajectory.map(
      (pt) =>
        `${pt.week},${pt.weightKg.toFixed(1)},${pt.leanMassKg.toFixed(1)},${pt.fatMassKg.toFixed(1)},${pt.bodyFatPct.toFixed(1)},${pt.projectedTdee}`
    ),
  ];

  return '\uFEFF' + lines.join('\r\n');
}
