namespace Vanguard.Domain.Models;

public sealed record MetabolicAnalyzeRequest(
    string Sex,
    int Age,
    double WeightKg,
    double HeightCm,
    double BodyFatPct,
    string ActivityLevel,
    string Goal,
    int DaysPerWeek = 4,
    string ExperienceLevel = "intermediate",
    double? Squat1RmKg = null,
    double? Bench1RmKg = null,
    double? Deadlift1RmKg = null);

public sealed record MacroTargets(
    int ProteinG,
    int CarbsG,
    int FatG,
    int ProteinKcal,
    int CarbsKcal,
    int FatKcal,
    int ProteinPct,
    int CarbsPct,
    int FatPct);

public sealed record WeeklyMesocyclePoint(
    int Week,
    string Mesocycle,
    bool IsDeload,
    int EffectiveSets,
    double VolumeDeltaFromPeakPct,
    int RelativeIntensityPct,
    double TargetRpe,
    int SessionLoadAu,
    double Acwr,
    double ProjectedWeightKg,
    double ProjectedLeanMassKg,
    double ProjectedBodyFatPct,
    double SquatLoadKg,
    double BenchLoadKg,
    double DeadliftLoadKg);

public sealed record MetabolicAnalyzeResponse(
    int Bmr,
    int Tdee,
    int TargetCalories,
    int DailyDeltaKcal,
    string GoalNormalized,
    double ActivityMultiplier,
    double HydrationLiters,
    int ElectrolyteSodiumMg,
    MacroTargets Macros,
    double PeakAcwr,
    IReadOnlyList<double> DeloadDropPcts,
    IReadOnlyList<WeeklyMesocyclePoint> Mesocycle12Week);
