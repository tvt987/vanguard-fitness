namespace Vanguard.Domain.Models;

public sealed record ReadinessZonesRequest(
    int Age,
    int RestingHr,
    int? CustomMaxHr = null,
    string AthleteTier = "hybrid_competitor",
    double HrvTodayMs = 82,
    double HrvBaselineMs = 76,
    double SleepHours = 7.6,
    double AcuteLoadAu = 2150,
    double ChronicLoadAu = 1980,
    int SubjectiveReadiness = 8);

public sealed record KarvonenZoneDto(
    int Zone,
    string Code,
    string Name,
    int PctHrrMin,
    int PctHrrMax,
    int MinBpm,
    int MaxBpm,
    int WeeklyMinutes,
    int WeeklySharePct,
    string LactateRangeMmol,
    string FuelSystem);

public sealed record PolarizedSplitSummaryDto(
    int TotalWeeklyMinutes,
    int LowIntensityMinutes,
    int TempoMinutes,
    int HighIntensityMinutes,
    int ModerateAndHighMinutes,
    int LowIntensityPct,
    int HighIntensityPct);

public sealed record LactateCurvePointDto(
    int PctHrr,
    int Bpm,
    double LactateMmol,
    string ZoneCode);

public sealed record LactateThresholdMarkerDto(
    string Label,
    int PctHrr,
    int Bpm,
    double LactateMmol,
    string Description);

public sealed record TelemetryDayPointDto(
    string DayLabel,
    int HrvMs,
    double Acwr,
    int ReadinessEst);

public sealed record DailySessionPrescriptionDto(
    string Tier,
    string Code,
    string Headline,
    string TargetZone,
    string Detail,
    int VolumeModifierPct);

public sealed record ReadinessZonesResponse(
    int Age,
    int RestingHr,
    int MaxHr,
    string MaxHrSource,
    int HeartRateReserve,
    string AthleteTier,
    double Vo2MaxMlKgMin,
    int Vo2Percentile,
    string Vo2Rating,
    IReadOnlyList<KarvonenZoneDto> Zones,
    PolarizedSplitSummaryDto PolarizedSplit,
    IReadOnlyList<LactateCurvePointDto> LactateCurve,
    LactateThresholdMarkerDto Lt1,
    LactateThresholdMarkerDto Lt2,
    int HrvTodayMs,
    int HrvBaselineMs,
    double HrvDeltaPct,
    double Acwr,
    string AcwrBand,
    string AcwrLabel,
    int CompositeReadinessScore,
    string ReadinessTier,
    DailySessionPrescriptionDto Prescription,
    IReadOnlyList<TelemetryDayPointDto> Telemetry7Day);
