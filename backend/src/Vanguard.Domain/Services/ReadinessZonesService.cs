using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

/// <summary>
/// Deterministic Equinox x WHOOP sports-science readiness &amp; polarized heart-rate zone engine.
/// Maintains exact formula parity with the frontend TypeScript engine (<c>readinessEngine.ts</c>):
/// Tanaka Max HR, Karvonen HR Reserve (Z1-Z5), Uth-Sorensen VO2 Max, Seiler 80/20 Polarized split,
/// exponential blood lactate curve passing through LT1 (2.0 mmol/L) and LT2 (4.0 mmol/L),
/// and autonomic HRV rMSSD + ACWR readiness auto-prescription (GREEN / AMBER / RED).
/// </summary>
public sealed class ReadinessZonesService : IReadinessZonesService
{
    private sealed record TierConfig(
        string CanonicalKey,
        int TotalWeeklyMinutes,
        int Lt1PctHrr,
        int Lt2PctHrr,
        double BaselineLactate);

    private sealed record ZoneSpec(
        int Zone,
        string Code,
        int PctMin,
        int PctMax,
        int WeeklySharePct,
        string Name,
        string LactateRangeMmol,
        string FuelSystem);

    private static readonly Dictionary<string, TierConfig> TierConfigs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["executive_wellness"] = new("executive_wellness", 240, 66, 81, 0.90),
        ["executive-wellness"] = new("executive_wellness", 240, 66, 81, 0.90),
        ["hybrid_competitor"] = new("hybrid_competitor", 360, 70, 85, 0.85),
        ["hybrid-competitor"] = new("hybrid_competitor", 360, 70, 85, 0.85),
        ["marathon_elite"] = new("marathon_elite", 540, 74, 89, 0.80),
        ["marathon-elite"] = new("marathon_elite", 540, 74, 89, 0.80),
    };

    private static readonly ZoneSpec[] ZoneSpecs =
    [
        new(1, "Z1", 50, 60, 20, "Active Recovery", "0.8–1.4", "Fat Oxidation · Parasympathetic Flush"),
        new(2, "Z2", 60, 70, 60, "Aerobic Base", "1.4–2.0", "Mitochondrial Density · Capillary Growth"),
        new(3, "Z3", 70, 80, 5, "Tempo / Marathon", "2.0–3.2", "Aerobic Glycolysis · Muscular Stamina"),
        new(4, "Z4", 80, 90, 10, "Lactate Threshold", "3.2–5.5", "Lactate Clearance · Buffering Capacity"),
        new(5, "Z5", 90, 100, 5, "VO2 Max Peak", "5.5–11.0", "Cardiac Stroke Volume · Anaerobic Power"),
    ];

    private static readonly double[] DayWeights = [0.05, 0.16, 0.28, 0.44, 0.62, 0.82, 1.0];
    private static readonly double[] DayWave = [-0.03, 0.04, -0.02, 0.03, -0.04, 0.02, 0.0];
    private static readonly string[] DayLabels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"];

    public (ReadinessZonesResponse? Result, string? ValidationError) Compute(ReadinessZonesRequest request)
    {
        if (request.Age is < 18 or > 75)
        {
            return (null, "age must be between 18 and 75.");
        }

        if (request.RestingHr is < 38 or > 90)
        {
            return (null, "restingHr must be between 38 and 90 bpm.");
        }

        if (request.CustomMaxHr is { } customMax)
        {
            if (customMax is < 130 or > 225)
            {
                return (null, "customMaxHr must be between 130 and 225 bpm when specified.");
            }

            if (customMax < request.RestingHr + 40)
            {
                return (null, "customMaxHr must exceed restingHr by at least 40 bpm to form valid HR reserve.");
            }
        }

        var tierKey = (request.AthleteTier ?? string.Empty).Trim();
        if (!TierConfigs.TryGetValue(tierKey, out var tierCfg))
        {
            return (null, "athleteTier must be one of: executive_wellness, hybrid_competitor, marathon_elite.");
        }

        if (request.HrvTodayMs is < 15 or > 180)
        {
            return (null, "hrvTodayMs must be between 15 and 180 ms.");
        }

        if (request.HrvBaselineMs is < 20 or > 160)
        {
            return (null, "hrvBaselineMs must be between 20 and 160 ms.");
        }

        if (request.SleepHours is < 4.0 or > 9.5)
        {
            return (null, "sleepHours must be between 4.0 and 9.5 hours.");
        }

        if (request.AcuteLoadAu is < 0 or > 6000)
        {
            return (null, "acuteLoadAu must be between 0 and 6000 AU.");
        }

        if (request.ChronicLoadAu is < 200 or > 5000)
        {
            return (null, "chronicLoadAu must be between 200 and 5000 AU.");
        }

        if (request.SubjectiveReadiness is < 1 or > 10)
        {
            return (null, "subjectiveReadiness must be between 1 and 10.");
        }

        var autoMaxHr = ComputeTanakaMaxHr(request.Age);
        var hasCustomMax = request.CustomMaxHr.HasValue;
        var maxHr = Math.Max(request.RestingHr + 40, hasCustomMax ? request.CustomMaxHr!.Value : autoMaxHr);
        var maxHrSource = hasCustomMax ? "custom_override" : "tanaka_auto";
        var hrr = maxHr - request.RestingHr;

        var vo2Max = ComputeUthSorensenVo2Max(maxHr, request.RestingHr);
        var (vo2Percentile, vo2Rating) = ComputeVo2Percentile(vo2Max, request.Age);

        var zones = new List<KarvonenZoneDto>(5);
        for (var i = 0; i < ZoneSpecs.Length; i++)
        {
            var spec = ZoneSpecs[i];
            var rawMin = RoundInt(request.RestingHr + (spec.PctMin / 100.0) * hrr);
            var maxBpm = spec.Zone == 5
                ? maxHr
                : RoundInt(request.RestingHr + (spec.PctMax / 100.0) * hrr);
            var minBpm = i == 0 ? rawMin : rawMin + 1;
            var weeklyMinutes = RoundInt((tierCfg.TotalWeeklyMinutes * spec.WeeklySharePct) / 100.0);

            zones.Add(new KarvonenZoneDto(
                Zone: spec.Zone,
                Code: spec.Code,
                Name: spec.Name,
                PctHrrMin: spec.PctMin,
                PctHrrMax: spec.PctMax,
                MinBpm: minBpm,
                MaxBpm: maxBpm,
                WeeklyMinutes: weeklyMinutes,
                WeeklySharePct: spec.WeeklySharePct,
                LactateRangeMmol: spec.LactateRangeMmol,
                FuelSystem: spec.FuelSystem));
        }

        var lowMinutes = zones[0].WeeklyMinutes + zones[1].WeeklyMinutes;
        var tempoMinutes = zones[2].WeeklyMinutes;
        var highMinutes = zones[3].WeeklyMinutes + zones[4].WeeklyMinutes;
        var polarizedSplit = new PolarizedSplitSummaryDto(
            TotalWeeklyMinutes: tierCfg.TotalWeeklyMinutes,
            LowIntensityMinutes: lowMinutes,
            TempoMinutes: tempoMinutes,
            HighIntensityMinutes: highMinutes,
            ModerateAndHighMinutes: tempoMinutes + highMinutes,
            LowIntensityPct: 80,
            HighIntensityPct: 20);

        var lactateCurve = new List<LactateCurvePointDto>(12);
        for (var pct = 45; pct <= 100; pct += 5)
        {
            lactateCurve.Add(new LactateCurvePointDto(
                PctHrr: pct,
                Bpm: RoundInt(request.RestingHr + (pct / 100.0) * hrr),
                LactateMmol: ComputeLactateAtPctHrr(pct, tierCfg),
                ZoneCode: ZoneCodeForPctHrr(pct)));
        }

        var lt1 = new LactateThresholdMarkerDto(
            Label: "LT1",
            PctHrr: tierCfg.Lt1PctHrr,
            Bpm: RoundInt(request.RestingHr + (tierCfg.Lt1PctHrr / 100.0) * hrr),
            LactateMmol: 2.0,
            Description: "Aerobic Threshold · Fat-Oxidation Ceiling (2.0 mmol/L)");

        var lt2 = new LactateThresholdMarkerDto(
            Label: "LT2",
            PctHrr: tierCfg.Lt2PctHrr,
            Bpm: RoundInt(request.RestingHr + (tierCfg.Lt2PctHrr / 100.0) * hrr),
            LactateMmol: 4.0,
            Description: "Anaerobic Turnpoint · Maximal Lactate Steady State (4.0 mmol/L)");

        var hrvTodayInt = RoundInt(request.HrvTodayMs);
        var hrvBaselineInt = RoundInt(request.HrvBaselineMs);
        var sleepRounded = Round1(request.SleepHours);
        var acuteInt = RoundInt(request.AcuteLoadAu);
        var chronicInt = RoundInt(request.ChronicLoadAu);

        var hrvDeltaPct = Round1(((hrvTodayInt - hrvBaselineInt) / (double)hrvBaselineInt) * 100.0);
        var acwr = Round2(acuteInt / (double)chronicInt);
        var (acwrBand, acwrLabel) = ClassifyAcwrBand(acwr);

        var hrvScore = Math.Clamp(76.0 + hrvDeltaPct * 1.45, 10.0, 100.0);
        var sleepScore = sleepRounded >= 8.0
            ? Math.Clamp(100.0 - Math.Max(0.0, sleepRounded - 9.0) * 6.0, 85.0, 100.0)
            : Math.Clamp(100.0 - (8.0 - sleepRounded) * 20.0, 15.0, 100.0);

        double acwrScore;
        if (acwr < 0.80)
        {
            acwrScore = Math.Clamp(78.0 - (0.80 - acwr) * 45.0, 45.0, 78.0);
        }
        else if (acwr <= 1.30)
        {
            acwrScore = Math.Clamp(96.0 - Math.Abs(acwr - 1.05) * 28.0, 86.0, 98.0);
        }
        else if (acwr <= 1.50)
        {
            acwrScore = Math.Clamp(65.0 - (acwr - 1.30) * 120.0, 40.0, 65.0);
        }
        else
        {
            acwrScore = Math.Clamp(32.0 - (acwr - 1.50) * 45.0, 5.0, 32.0);
        }

        var subjectiveScore = Math.Clamp(request.SubjectiveReadiness * 10.0, 10.0, 100.0);
        var weightedScore =
            0.38 * hrvScore +
            0.24 * sleepScore +
            0.23 * acwrScore +
            0.15 * subjectiveScore;

        if (acwr > 1.50 || hrvDeltaPct <= -22.0)
        {
            weightedScore = Math.Min(weightedScore, 44.0);
        }
        else if (acwr > 1.30 || hrvDeltaPct <= -12.0 || sleepRounded < 5.5)
        {
            weightedScore = Math.Min(weightedScore, 68.0);
        }

        var compositeScore = Math.Clamp(RoundInt(weightedScore), 0, 100);
        var prescription = BuildPrescription(compositeScore);

        var telemetry7Day = new List<TelemetryDayPointDto>(7);
        for (var i = 0; i < 7; i++)
        {
            var t = DayWeights[i];
            var wave = DayWave[i];
            var hrvVal = i == 6
                ? hrvTodayInt
                : Math.Clamp(
                    RoundInt(hrvBaselineInt + (hrvTodayInt - hrvBaselineInt) * t + hrvBaselineInt * wave),
                    15,
                    180);
            var acwrVal = i == 6
                ? acwr
                : Round2(Math.Clamp(1.0 + (acwr - 1.0) * t + wave * 0.8, 0.45, 2.2));
            var estReadiness = i == 6
                ? compositeScore
                : Math.Clamp(
                    RoundInt(76.0 + ((hrvVal - hrvBaselineInt) / (double)hrvBaselineInt) * 110.0 - Math.Max(0.0, acwrVal - 1.3) * 85.0),
                    15,
                    99);

            telemetry7Day.Add(new TelemetryDayPointDto(
                DayLabel: DayLabels[i],
                HrvMs: hrvVal,
                Acwr: acwrVal,
                ReadinessEst: estReadiness));
        }

        var response = new ReadinessZonesResponse(
            Age: request.Age,
            RestingHr: request.RestingHr,
            MaxHr: maxHr,
            MaxHrSource: maxHrSource,
            HeartRateReserve: hrr,
            AthleteTier: tierCfg.CanonicalKey,
            Vo2MaxMlKgMin: vo2Max,
            Vo2Percentile: vo2Percentile,
            Vo2Rating: vo2Rating,
            Zones: zones,
            PolarizedSplit: polarizedSplit,
            LactateCurve: lactateCurve,
            Lt1: lt1,
            Lt2: lt2,
            HrvTodayMs: hrvTodayInt,
            HrvBaselineMs: hrvBaselineInt,
            HrvDeltaPct: hrvDeltaPct,
            Acwr: acwr,
            AcwrBand: acwrBand,
            AcwrLabel: acwrLabel,
            CompositeReadinessScore: compositeScore,
            ReadinessTier: prescription.Tier,
            Prescription: prescription,
            Telemetry7Day: telemetry7Day);

        return (response, null);
    }

    public static int ComputeTanakaMaxHr(int age) =>
        RoundInt(208.0 - 0.7 * Math.Clamp(age, 18, 75));

    public static double ComputeUthSorensenVo2Max(int maxHr, int restingHr) =>
        Round1(15.3 * (maxHr / (double)Math.Max(30, restingHr)));

    private static (int Percentile, string Rating) ComputeVo2Percentile(double vo2Max, int age)
    {
        var refMedian = Math.Clamp(44.0 - (age - 25) * 0.34, 26.0, 46.0);
        var z = (vo2Max - refMedian) / 7.5;
        var logistic = 100.0 / (1.0 + Math.Exp(-1.55 * z));
        var percentile = Math.Clamp(RoundInt(logistic), 5, 99);

        var rating = percentile switch
        {
            >= 90 => "Superior",
            >= 75 => "Excellent",
            >= 55 => "Good",
            >= 35 => "Fair",
            _ => "Developing",
        };

        return (percentile, rating);
    }

    private static double ComputeLactateAtPctHrr(int pctHrr, TierConfig cfg)
    {
        var a = 2.0 - cfg.BaselineLactate;
        var k = Math.Log((4.0 - cfg.BaselineLactate) / a) / (cfg.Lt2PctHrr - cfg.Lt1PctHrr);
        var raw = cfg.BaselineLactate + a * Math.Exp(k * (pctHrr - cfg.Lt1PctHrr));
        return Round2(Math.Clamp(raw, 0.7, 13.5));
    }

    private static (string Band, string Label) ClassifyAcwrBand(double acwr)
    {
        if (acwr < 0.80)
        {
            return ("undertrained", "Undertrained (<0.80)");
        }

        if (acwr <= 1.30)
        {
            return ("optimal", "Optimal Sweet Spot (0.80–1.30)");
        }

        if (acwr <= 1.50)
        {
            return ("caution", "Caution Zone (1.31–1.50)");
        }

        return ("high_injury_risk", "High Injury Risk (>1.50)");
    }

    private static string ZoneCodeForPctHrr(int pctHrr) => pctHrr switch
    {
        < 60 => "Z1",
        < 70 => "Z2",
        < 80 => "Z3",
        < 90 => "Z4",
        _ => "Z5",
    };

    private static DailySessionPrescriptionDto BuildPrescription(int score)
    {
        if (score >= 72)
        {
            return new DailySessionPrescriptionDto(
                Tier: "GREEN",
                Code: "PEAK_OUTPUT",
                Headline: "GREEN Peak Output — Full Threshold Intervals",
                TargetZone: "Z4–Z5 Threshold / VO2 Intervals",
                Detail: "Autonomic balance & ACWR are primed. Execute full 4×8m LT2 intervals or heavy compound peaking lifts, finished with 10m Z1 parasympathetic flush.",
                VolumeModifierPct: 100);
        }

        if (score >= 45)
        {
            return new DailySessionPrescriptionDto(
                Tier: "AMBER",
                Code: "MODIFY_AEROBIC",
                Headline: "AMBER Modify — Cap at Z2 Aerobic Base",
                TargetZone: "Z2 Aerobic Base (60–70% HRR)",
                Detail: "Mild sympathetic fatigue or elevated ACWR detected. Reduce total volume 30%, cap heart rate strictly below LT1 aerobic turnpoint, add 1,000mg sodium + extra sleep.",
                VolumeModifierPct: 70);
        }

        return new DailySessionPrescriptionDto(
            Tier: "RED",
            Code: "RECOVER_RESTORATIVE",
            Headline: "RED Recover — 35m Mobility & Cold Plunge",
            TargetZone: "Z1 Parasympathetic Restore (<60% HRR)",
            Detail: "High injury-risk ACWR spike or steep HRV suppression. Cancel anaerobic intervals; perform 35m Reformer mobility, nasal breathwork, and 4.8°C basalt contrast therapy.",
            VolumeModifierPct: 35);
    }

    private static int RoundInt(double v) => (int)Math.Round(v, 0, MidpointRounding.AwayFromZero);
    private static double Round1(double v) => Math.Round(v, 1, MidpointRounding.AwayFromZero);
    private static double Round2(double v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
}
