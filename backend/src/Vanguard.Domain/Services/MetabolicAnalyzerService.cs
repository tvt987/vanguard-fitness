using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

/// <summary>
/// Deterministic sports-science metabolic engine implementing exact Mifflin-St Jeor BMR,
/// 5-tier TDEE multipliers, goal-calibrated macro splits (cut / recomp / lean-bulk),
/// and a 12-week 3-mesocycle periodized projection with W4/W8/W12 deloads and ACWR <= 1.35 safety guard.
/// </summary>
public sealed class MetabolicAnalyzerService : IMetabolicAnalyzerService
{
    public const double MaxSafeAcwr = 1.35;

    private static readonly Dictionary<string, double> ActivityMultipliers = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sedentary"] = 1.2,
        ["light"] = 1.375,
        ["moderate"] = 1.55,
        ["athlete"] = 1.725,
        ["elite"] = 1.9,
    };

    private static readonly Dictionary<string, double> HydrationBonuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sedentary"] = 0.2,
        ["light"] = 0.45,
        ["moderate"] = 0.75,
        ["athlete"] = 1.1,
        ["elite"] = 1.45,
    };

    private static readonly Dictionary<string, int> SodiumBonuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sedentary"] = 0,
        ["light"] = 350,
        ["moderate"] = 700,
        ["athlete"] = 1150,
        ["elite"] = 1600,
    };

    private static readonly Dictionary<int, int> DaysBaseSets = new()
    {
        [3] = 42,
        [4] = 52,
        [5] = 62,
        [6] = 72,
    };

    private static readonly double[] VolumeWave =
        [1.0, 1.07, 1.14, 0.6, 1.04, 1.11, 1.16, 0.6, 1.0, 1.06, 1.10, 0.6];

    private static readonly int[] IntensityWaveCutRecomp =
        [70, 72, 75, 65, 74, 77, 80, 68, 78, 81, 84, 70];

    private static readonly int[] IntensityWaveBulk =
        [68, 70, 73, 64, 72, 75, 78, 66, 76, 79, 82, 68];

    private static readonly double[] RpeWave =
        [7.0, 7.5, 8.0, 6.5, 7.5, 8.0, 8.5, 6.5, 8.0, 8.5, 9.0, 6.5];

    public (MetabolicAnalyzeResponse? Result, string? ValidationError) Analyze(MetabolicAnalyzeRequest request)
    {
        var sex = (request.Sex ?? string.Empty).Trim().ToLowerInvariant();
        if (sex is not ("male" or "female"))
        {
            return (null, "sex must be 'male' or 'female'.");
        }

        if (request.Age is < 16 or > 85)
        {
            return (null, "age must be between 16 and 85.");
        }

        if (request.WeightKg is < 35 or > 220)
        {
            return (null, "weightKg must be between 35 and 220.");
        }

        if (request.HeightCm is < 135 or > 225)
        {
            return (null, "heightCm must be between 135 and 225.");
        }

        if (request.BodyFatPct is < 5 or > 55)
        {
            return (null, "bodyFatPct must be between 5 and 55.");
        }

        var activityKey = (request.ActivityLevel ?? string.Empty).Trim().ToLowerInvariant();
        if (!ActivityMultipliers.TryGetValue(activityKey, out var multiplier))
        {
            return (null, "activityLevel must be one of: sedentary, light, moderate, athlete, elite.");
        }

        var goalNormalized = NormalizeGoal(request.Goal);
        if (goalNormalized is null)
        {
            return (null, "goal must be one of: cut, recomp, lean-bulk (aliases: fat_loss, lean_recomp, hypertrophy).");
        }

        var daysPerWeek = Math.Clamp(request.DaysPerWeek, 3, 6);
        var expKey = (request.ExperienceLevel ?? "intermediate").Trim().ToLowerInvariant();
        var expMult = expKey switch
        {
            "novice" => 0.84,
            "advanced" => 1.14,
            _ => 1.0,
        };

        var bmr = CalculateMifflinStJeorBmr(sex, request.WeightKg, request.HeightCm, request.Age);
        var tdee = (int)Math.Round(bmr * multiplier, MidpointRounding.AwayFromZero);
        var floorKcal = sex == "male" ? 1500 : 1200;

        var rawTarget = goalNormalized switch
        {
            "cut" => tdee - Math.Clamp((int)Math.Round(tdee * 0.18, MidpointRounding.AwayFromZero), 350, 620),
            "recomp" => (int)Math.Round(tdee * 0.95, MidpointRounding.AwayFromZero),
            "lean-bulk" => tdee + Math.Clamp((int)Math.Round(tdee * 0.12, MidpointRounding.AwayFromZero), 220, 390),
            _ => tdee,
        };

        var targetCalories = Math.Max(floorKcal, rawTarget);
        var dailyDelta = targetCalories - tdee;
        var macros = CalculateMacros(targetCalories, request.WeightKg, request.BodyFatPct, goalNormalized);

        var goalHydrationBonus = goalNormalized == "cut" ? 0.2 : 0.1;
        var hydrationLiters = Round1(request.WeightKg * 0.035 + HydrationBonuses[activityKey] + goalHydrationBonus);
        var sodiumMg = 2300 + SodiumBonuses[activityKey];

        var squat1Rm = Math.Clamp(request.Squat1RmKg ?? (sex == "male" ? 140 : 95), 30, 350);
        var bench1Rm = Math.Clamp(request.Bench1RmKg ?? (sex == "male" ? 100 : 60), 20, 260);
        var deadlift1Rm = Math.Clamp(request.Deadlift1RmKg ?? (sex == "male" ? 175 : 115), 40, 400);

        var (mesocycle12Week, peakAcwr, deloadDrops) = Build12WeekProjection(
            sex: sex,
            weightKg: request.WeightKg,
            bodyFatPct: request.BodyFatPct,
            dailyDelta: dailyDelta,
            goalNormalized: goalNormalized,
            daysPerWeek: daysPerWeek,
            expMult: expMult,
            squat1Rm: squat1Rm,
            bench1Rm: bench1Rm,
            deadlift1Rm: deadlift1Rm);

        var response = new MetabolicAnalyzeResponse(
            Bmr: bmr,
            Tdee: tdee,
            TargetCalories: targetCalories,
            DailyDeltaKcal: dailyDelta,
            GoalNormalized: goalNormalized,
            ActivityMultiplier: multiplier,
            HydrationLiters: hydrationLiters,
            ElectrolyteSodiumMg: sodiumMg,
            Macros: macros,
            PeakAcwr: peakAcwr,
            DeloadDropPcts: deloadDrops,
            Mesocycle12Week: mesocycle12Week);

        return (response, null);
    }

    public static int CalculateMifflinStJeorBmr(string sex, double weightKg, double heightCm, int age)
    {
        var baseVal = 10.0 * weightKg + 6.25 * heightCm - 5.0 * age;
        var adjusted = sex.Equals("male", StringComparison.OrdinalIgnoreCase)
            ? baseVal + 5.0
            : baseVal - 161.0;
        return (int)Math.Round(adjusted, MidpointRounding.AwayFromZero);
    }

    private static string? NormalizeGoal(string? rawGoal)
    {
        var normalized = (rawGoal ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "cut" or "fat_loss" or "fat-loss" => "cut",
            "recomp" or "lean_recomp" or "lean-recomp" => "recomp",
            "lean-bulk" or "lean_bulk" or "hypertrophy" or "bulk" => "lean-bulk",
            _ => null,
        };
    }

    private static MacroTargets CalculateMacros(
        int targetCalories,
        double weightKg,
        double bodyFatPct,
        string goalNormalized)
    {
        var leanFactor = bodyFatPct > 28 ? 1.0 - (bodyFatPct - 28.0) * 0.01 : 1.0;
        var refWeight = weightKg * Math.Clamp(leanFactor, 0.78, 1.0);

        var proteinPerKg = goalNormalized switch
        {
            "cut" => 2.2,
            "recomp" => 2.25,
            _ => 2.0,
        };

        var fatShare = goalNormalized switch
        {
            "cut" => 0.26,
            "recomp" => 0.27,
            _ => 0.25,
        };

        var rawProteinG = (int)Math.Round(refWeight * proteinPerKg, MidpointRounding.AwayFromZero);
        var maxProteinG = (int)Math.Floor((targetCalories * 0.44) / 4.0);
        var proteinG = Math.Min(rawProteinG, maxProteinG);
        var proteinKcal = proteinG * 4;

        var minFatG = (int)Math.Round(refWeight * 0.65, MidpointRounding.AwayFromZero);
        var fatG = Math.Max(minFatG, (int)Math.Round((targetCalories * fatShare) / 9.0, MidpointRounding.AwayFromZero));
        var fatKcal = fatG * 9;

        const int minCarbsG = 65;
        var remainingKcal = targetCalories - proteinKcal - fatKcal;
        if (remainingKcal < minCarbsG * 4)
        {
            var neededKcal = minCarbsG * 4 - remainingKcal;
            var fatReduction = (int)Math.Ceiling(neededKcal / 9.0);
            fatG = Math.Max(35, fatG - fatReduction);
            fatKcal = fatG * 9;
            remainingKcal = Math.Max(minCarbsG * 4, targetCalories - proteinKcal - fatKcal);
        }

        var carbsG = Math.Max(minCarbsG, (int)Math.Round(remainingKcal / 4.0, MidpointRounding.AwayFromZero));
        var carbsKcal = carbsG * 4;

        var totalKcal = proteinKcal + carbsKcal + fatKcal;
        var proteinPct = (int)Math.Round((proteinKcal / (double)totalKcal) * 100.0, MidpointRounding.AwayFromZero);
        var fatPct = (int)Math.Round((fatKcal / (double)totalKcal) * 100.0, MidpointRounding.AwayFromZero);
        var carbsPct = Math.Max(0, 100 - proteinPct - fatPct);

        return new MacroTargets(
            ProteinG: proteinG,
            CarbsG: carbsG,
            FatG: fatG,
            ProteinKcal: proteinKcal,
            CarbsKcal: carbsKcal,
            FatKcal: fatKcal,
            ProteinPct: proteinPct,
            CarbsPct: carbsPct,
            FatPct: fatPct);
    }

    private static (IReadOnlyList<WeeklyMesocyclePoint> Weeks, double PeakAcwr, IReadOnlyList<double> DeloadDrops)
        Build12WeekProjection(
            string sex,
            double weightKg,
            double bodyFatPct,
            int dailyDelta,
            string goalNormalized,
            int daysPerWeek,
            double expMult,
            double squat1Rm,
            double bench1Rm,
            double deadlift1Rm)
    {
        var goalVolMult = goalNormalized switch
        {
            "lean-bulk" => 1.15,
            "recomp" => 0.96,
            _ => 0.92,
        };

        var baselineSets = (int)Math.Round(DaysBaseSets[daysPerWeek] * expMult * goalVolMult, MidpointRounding.AwayFromZero);
        var intensityWave = goalNormalized == "lean-bulk" ? IntensityWaveBulk : IntensityWaveCutRecomp;

        var weeks = new List<WeeklyMesocyclePoint>(12);
        var loadHistory = new List<int>(12);
        var deloadDrops = new List<double>(3);

        var w1Sets = Math.Max(24, (int)Math.Round(baselineSets * VolumeWave[0], MidpointRounding.AwayFromZero));
        var habitualChronicLoad = (int)Math.Round(ComputeLoadAu(w1Sets, intensityWave[0], RpeWave[0]) * 0.95);

        var currentFat = weightKg * (bodyFatPct / 100.0);
        var currentLean = weightKg - currentFat;
        var minBf = sex == "male" ? 6.5 : 13.5;

        for (var i = 0; i < 12; i++)
        {
            var weekNum = i + 1;
            var isDeload = weekNum is 4 or 8 or 12;
            var mesocycle = weekNum <= 4
                ? "Accumulation"
                : weekNum <= 8
                    ? "Intensification"
                    : "Peak & Deload";

            var intensity = intensityWave[i];
            var rpe = RpeWave[i];

            int effectiveSets;
            double volumeDeltaPct = 0;

            if (isDeload)
            {
                var prevPeak = weeks[i - 1].EffectiveSets;
                effectiveSets = Math.Max(12, (int)Math.Round(prevPeak * 0.60, MidpointRounding.AwayFromZero));
                volumeDeltaPct = Round1(((effectiveSets - prevPeak) / (double)prevPeak) * 100.0);
                deloadDrops.Add(volumeDeltaPct);
            }
            else
            {
                effectiveSets = Math.Max(24, (int)Math.Round(baselineSets * VolumeWave[i], MidpointRounding.AwayFromZero));
            }

            double ComputeChronic(int candidateLoad)
            {
                double sum = candidateLoad;
                for (var back = 1; back <= 3; back++)
                {
                    var idx = i - back;
                    sum += idx >= 0 ? loadHistory[idx] : habitualChronicLoad;
                }

                return sum / 4.0;
            }

            var loadAu = ComputeLoadAu(effectiveSets, intensity, rpe);
            var chronic = ComputeChronic(loadAu);
            var acwr = Round2(loadAu / Math.Max(1.0, chronic));

            if (!isDeload)
            {
                while (acwr > MaxSafeAcwr && effectiveSets > 18)
                {
                    effectiveSets--;
                    loadAu = ComputeLoadAu(effectiveSets, intensity, rpe);
                    chronic = ComputeChronic(loadAu);
                    acwr = Round2(loadAu / Math.Max(1.0, chronic));
                }

                if (i > 0 && !weeks[i - 1].IsDeload)
                {
                    volumeDeltaPct = Round1(((effectiveSets - weeks[i - 1].EffectiveSets) / (double)weeks[i - 1].EffectiveSets) * 100.0);
                }
            }

            loadHistory.Add(loadAu);

            // Weekly body composition trajectory
            var adapt = 1.0 - 0.014 * i;
            if (goalNormalized == "cut")
            {
                var weeklyDeficit = Math.Abs(Math.Min(0, dailyDelta)) * 7.0 * adapt;
                currentFat = Math.Max((currentLean * minBf) / (100.0 - minBf), currentFat - weeklyDeficit / 7700.0);
                currentLean += 0.02 * adapt;
            }
            else if (goalNormalized == "recomp")
            {
                currentFat = Math.Max((currentLean * minBf) / (100.0 - minBf), currentFat - 0.24 * adapt);
                currentLean += (sex == "male" ? 0.16 : 0.11) * adapt;
            }
            else
            {
                var weeklySurplus = Math.Max(150, dailyDelta) * 7.0 * adapt;
                var maxLean = sex == "male" ? 0.23 : 0.15;
                currentLean += Math.Min(maxLean, (weeklySurplus * 0.65) / 5500.0);
                currentFat += Math.Max(0.04, (weeklySurplus * 0.35) / 7700.0);
            }

            var totalWeight = currentLean + currentFat;
            var bf = (currentFat / totalWeight) * 100.0;

            weeks.Add(new WeeklyMesocyclePoint(
                Week: weekNum,
                Mesocycle: mesocycle,
                IsDeload: isDeload,
                EffectiveSets: effectiveSets,
                VolumeDeltaFromPeakPct: volumeDeltaPct,
                RelativeIntensityPct: intensity,
                TargetRpe: rpe,
                SessionLoadAu: loadAu,
                Acwr: acwr,
                ProjectedWeightKg: Round1(totalWeight),
                ProjectedLeanMassKg: Round1(currentLean),
                ProjectedBodyFatPct: Round1(bf),
                SquatLoadKg: RoundToPlate(squat1Rm * (intensity / 100.0)),
                BenchLoadKg: RoundToPlate(bench1Rm * (intensity / 100.0)),
                DeadliftLoadKg: RoundToPlate(deadlift1Rm * (intensity / 100.0))));
        }

        var peakAcwr = weeks.Max(w => w.Acwr);
        return (weeks, peakAcwr, deloadDrops);
    }

    private static int ComputeLoadAu(int sets, int intensityPct, double rpe) =>
        (int)Math.Round(sets * (intensityPct / 100.0) * rpe * 10.0, MidpointRounding.AwayFromZero);

    private static double RoundToPlate(double rawKg) =>
        Math.Max(2.5, Math.Round(rawKg / 2.5, MidpointRounding.AwayFromZero) * 2.5);

    private static double Round1(double v) => Math.Round(v, 1, MidpointRounding.AwayFromZero);
    private static double Round2(double v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
}
