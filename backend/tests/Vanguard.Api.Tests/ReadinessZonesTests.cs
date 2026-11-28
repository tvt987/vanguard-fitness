using System.Net;
using System.Net.Http.Json;
using Vanguard.Domain.Models;
using Vanguard.Domain.Services;
using Xunit;

namespace Vanguard.Api.Tests;

public sealed class ReadinessZonesTests
{
    private readonly ReadinessZonesService _service = new();

    [Fact]
    public void Domain_ComputesExactTanakaMaxHrAndKarvonenFiveZoneBands()
    {
        // Age 40 -> Tanaka MaxHR = 180, RHR 60 -> HRR = 120
        var (result, error) = _service.Compute(new ReadinessZonesRequest(
            Age: 40,
            RestingHr: 60,
            AthleteTier: "hybrid_competitor"));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(180, result.MaxHr);
        Assert.Equal("tanaka_auto", result.MaxHrSource);
        Assert.Equal(120, result.HeartRateReserve);
        Assert.Equal(5, result.Zones.Count);

        Assert.Equal((120, 132), (result.Zones[0].MinBpm, result.Zones[0].MaxBpm));
        Assert.Equal((133, 144), (result.Zones[1].MinBpm, result.Zones[1].MaxBpm));
        Assert.Equal((145, 156), (result.Zones[2].MinBpm, result.Zones[2].MaxBpm));
        Assert.Equal((157, 168), (result.Zones[3].MinBpm, result.Zones[3].MaxBpm));
        Assert.Equal((169, 180), (result.Zones[4].MinBpm, result.Zones[4].MaxBpm));
    }

    [Fact]
    public void Domain_CustomMaxHrOverrideReplacesTanakaFormula()
    {
        var (result, error) = _service.Compute(new ReadinessZonesRequest(
            Age: 35,
            RestingHr: 50,
            CustomMaxHr: 198,
            AthleteTier: "marathon_elite"));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(198, result.MaxHr);
        Assert.Equal("custom_override", result.MaxHrSource);
        Assert.Equal(148, result.HeartRateReserve);
        Assert.Equal(198, result.Zones[^1].MaxBpm);
    }

    [Fact]
    public void Domain_ComputesExactUthSorensenVo2MaxAndPercentileOrdering()
    {
        // 15.3 * 186 / 52 = 54.726 -> 54.7
        var (club, err1) = _service.Compute(new ReadinessZonesRequest(Age: 31, RestingHr: 52));
        var (elite, err2) = _service.Compute(new ReadinessZonesRequest(Age: 31, RestingHr: 42));

        Assert.Null(err1);
        Assert.Null(err2);
        Assert.Equal(54.7, club!.Vo2MaxMlKgMin);
        Assert.True(elite!.Vo2MaxMlKgMin > club.Vo2MaxMlKgMin);
        Assert.True(elite.Vo2Percentile >= club.Vo2Percentile);
        Assert.Equal("Superior", elite.Vo2Rating);
    }

    [Theory]
    [InlineData("executive_wellness", 240, 192, 48, 66, 81)]
    [InlineData("hybrid_competitor", 360, 288, 72, 70, 85)]
    [InlineData("marathon_elite", 540, 432, 108, 74, 89)]
    public void Domain_Enforces8020PolarizedSplitAndTierLactateThresholds(
        string tier,
        int expectedTotalMin,
        int expectedLowMin,
        int expectedHighMin,
        int expectedLt1Pct,
        int expectedLt2Pct)
    {
        var (result, error) = _service.Compute(new ReadinessZonesRequest(
            Age: 31,
            RestingHr: 52,
            AthleteTier: tier));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(expectedTotalMin, result.PolarizedSplit.TotalWeeklyMinutes);
        Assert.Equal(expectedLowMin, result.PolarizedSplit.LowIntensityMinutes);
        Assert.Equal(expectedHighMin, result.PolarizedSplit.ModerateAndHighMinutes);
        Assert.Equal(80, result.PolarizedSplit.LowIntensityPct);
        Assert.Equal(20, result.PolarizedSplit.HighIntensityPct);
        Assert.Equal(expectedTotalMin, result.Zones.Sum(z => z.WeeklyMinutes));

        Assert.Equal(expectedLt1Pct, result.Lt1.PctHrr);
        Assert.Equal(2.0, result.Lt1.LactateMmol);
        Assert.Equal(expectedLt2Pct, result.Lt2.PctHrr);
        Assert.Equal(4.0, result.Lt2.LactateMmol);
        Assert.True(result.Lt2.Bpm > result.Lt1.Bpm);
    }

    [Fact]
    public void Domain_LactateCurveIsStrictlyMonotonicAcross12Steps()
    {
        var (result, error) = _service.Compute(new ReadinessZonesRequest(Age: 31, RestingHr: 52));
        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(12, result.LactateCurve.Count);
        Assert.Equal(45, result.LactateCurve[0].PctHrr);
        Assert.Equal(100, result.LactateCurve[^1].PctHrr);

        for (var i = 1; i < result.LactateCurve.Count; i++)
        {
            Assert.True(result.LactateCurve[i].LactateMmol > result.LactateCurve[i - 1].LactateMmol);
            Assert.True(result.LactateCurve[i].Bpm > result.LactateCurve[i - 1].Bpm);
        }
    }

    [Theory]
    [InlineData(1400, 2000, "undertrained")]
    [InlineData(2000, 2000, "optimal")]
    [InlineData(2600, 2000, "optimal")]
    [InlineData(2800, 2000, "caution")]
    [InlineData(3200, 2000, "high_injury_risk")]
    public void Domain_ClassifiesAllFourAcwrInjuryRiskBands(
        double acuteAu,
        double chronicAu,
        string expectedBand)
    {
        var (result, error) = _service.Compute(new ReadinessZonesRequest(
            Age: 31,
            RestingHr: 52,
            AcuteLoadAu: acuteAu,
            ChronicLoadAu: chronicAu));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(expectedBand, result.AcwrBand);
    }

    [Fact]
    public async Task Endpoint_PeakRaceTaper_Returns200GreenPeakOutputWith7DayTelemetry()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/readiness-zones",
            new ReadinessZonesRequest(
                Age: 29,
                RestingHr: 46,
                CustomMaxHr: null,
                AthleteTier: "marathon_elite",
                HrvTodayMs: 98,
                HrvBaselineMs: 84,
                SleepHours: 8.4,
                AcuteLoadAu: 1890,
                ChronicLoadAu: 2050,
                SubjectiveReadiness: 9));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = (await resp.Content.ReadFromJsonAsync<ReadinessZonesResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal("GREEN", body.ReadinessTier);
        Assert.Equal("PEAK_OUTPUT", body.Prescription.Code);
        Assert.Equal(100, body.Prescription.VolumeModifierPct);
        Assert.Equal("optimal", body.AcwrBand);
        Assert.Equal(16.7, body.HrvDeltaPct);
        Assert.True(body.CompositeReadinessScore >= 85);
        Assert.Equal(7, body.Telemetry7Day.Count);
        Assert.Equal("Today", body.Telemetry7Day[^1].DayLabel);
        Assert.Equal(98, body.Telemetry7Day[^1].HrvMs);
        Assert.Equal(body.Acwr, body.Telemetry7Day[^1].Acwr);
    }

    [Fact]
    public async Task Endpoint_ExecutiveJetlagRecovery_Returns200AmberModifyAerobic()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/readiness-zones",
            new ReadinessZonesRequest(
                Age: 38,
                RestingHr: 58,
                AthleteTier: "executive_wellness",
                HrvTodayMs: 56,
                HrvBaselineMs: 66,
                SleepHours: 5.8,
                AcuteLoadAu: 1920,
                ChronicLoadAu: 1560,
                SubjectiveReadiness: 5));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = (await resp.Content.ReadFromJsonAsync<ReadinessZonesResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal("AMBER", body.ReadinessTier);
        Assert.Equal("MODIFY_AEROBIC", body.Prescription.Code);
        Assert.Equal(70, body.Prescription.VolumeModifierPct);
        Assert.InRange(body.CompositeReadinessScore, 45, 71);
    }

    [Fact]
    public async Task Endpoint_OverreachingRedAlert_Returns200RedRecoverAndFlagsHighInjuryRisk()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/readiness-zones",
            new ReadinessZonesRequest(
                Age: 31,
                RestingHr: 64,
                AthleteTier: "hybrid_competitor",
                HrvTodayMs: 49,
                HrvBaselineMs: 74,
                SleepHours: 5.0,
                AcuteLoadAu: 3320,
                ChronicLoadAu: 2050,
                SubjectiveReadiness: 3));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = (await resp.Content.ReadFromJsonAsync<ReadinessZonesResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal("RED", body.ReadinessTier);
        Assert.Equal("RECOVER_RESTORATIVE", body.Prescription.Code);
        Assert.Equal(35, body.Prescription.VolumeModifierPct);
        Assert.Equal("high_injury_risk", body.AcwrBand);
        Assert.True(body.Acwr > 1.50);
        Assert.True(body.CompositeReadinessScore <= 44);
    }

    [Theory]
    [InlineData(15, 52, null, "hybrid_competitor", 80, 75, 7.5, 2000, 2000, 7)] // age < 18
    [InlineData(31, 30, null, "hybrid_competitor", 80, 75, 7.5, 2000, 2000, 7)] // restingHr < 38
    [InlineData(31, 80, 110, "hybrid_competitor", 80, 75, 7.5, 2000, 2000, 7)] // customMaxHr < 130
    [InlineData(31, 90, 125, "hybrid_competitor", 80, 75, 7.5, 2000, 2000, 7)] // customMaxHr invalid
    [InlineData(31, 52, null, "invalid_tier", 80, 75, 7.5, 2000, 2000, 7)] // unknown athleteTier
    [InlineData(31, 52, null, "hybrid_competitor", 80, 75, 2.5, 2000, 2000, 7)] // sleepHours < 4.0
    [InlineData(31, 52, null, "hybrid_competitor", 80, 75, 7.5, 2000, 100, 7)] // chronicLoadAu < 200
    [InlineData(31, 52, null, "hybrid_competitor", 80, 75, 7.5, 2000, 2000, 12)] // subjectiveReadiness > 10
    public async Task Endpoint_InvalidReadinessPayload_Returns400BadRequest(
        int age,
        int restingHr,
        int? customMaxHr,
        string tier,
        double hrvToday,
        double hrvBaseline,
        double sleepHours,
        double acuteAu,
        double chronicAu,
        int subjective)
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/readiness-zones",
            new ReadinessZonesRequest(
                Age: age,
                RestingHr: restingHr,
                CustomMaxHr: customMaxHr,
                AthleteTier: tier,
                HrvTodayMs: hrvToday,
                HrvBaselineMs: hrvBaseline,
                SleepHours: sleepHours,
                AcuteLoadAu: acuteAu,
                ChronicLoadAu: chronicAu,
                SubjectiveReadiness: subjective));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
