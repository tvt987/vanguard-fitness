using System.Net;
using System.Net.Http.Json;
using Vanguard.Domain.Models;
using Vanguard.Domain.Services;
using Xunit;

namespace Vanguard.Api.Tests;

public sealed class MetabolicAndPeriodizationApiTests
{
    private sealed record HealthResponse(
        string Status,
        string Service,
        string Version,
        int ActiveClasses);

    [Fact]
    public async Task HealthEndpoint_Returns200HealthyWithActiveClassCount()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var payload = await resp.Content.ReadFromJsonAsync<HealthResponse>(VanguardWebApplicationFactory.JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal("healthy", payload.Status);
        Assert.Equal("vanguard-api", payload.Service);
        Assert.True(payload.ActiveClasses >= 8);
    }

    [Fact]
    public async Task MetabolicAnalyze_ComputesExactMifflinStJeorBmrForMaleAndFemale()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        // Male: 10*78 + 6.25*178 - 5*28 + 5 = 1757.5 -> 1758
        var maleResp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 28, 78, 178, 18, "moderate", "cut"));
        Assert.Equal(HttpStatusCode.OK, maleResp.StatusCode);
        var male = (await maleResp.Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        Assert.Equal(1758, male.Bmr);

        // Female: 10*58 + 6.25*165 - 5*26 - 161 = 1320.25 -> 1320
        var femaleResp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("female", 26, 58, 165, 22, "moderate", "recomp"));
        Assert.Equal(HttpStatusCode.OK, femaleResp.StatusCode);
        var female = (await femaleResp.Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        Assert.Equal(1320, female.Bmr);
    }

    [Fact]
    public async Task MetabolicAnalyze_ScalesTdeeStrictlyMonotonicallyAcrossFiveActivityMultipliers()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        string[] levels = ["sedentary", "light", "moderate", "athlete", "elite"];
        var tdees = new List<int>();

        foreach (var level in levels)
        {
            var resp = await client.PostAsJsonAsync(
                "/api/v1/metabolic/analyze",
                new MetabolicAnalyzeRequest("male", 30, 80, 180, 16, level, "recomp"));
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
            var body = (await resp.Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;
            tdees.Add(body.Tdee);
        }

        for (var i = 1; i < tdees.Count; i++)
        {
            Assert.True(tdees[i] > tdees[i - 1], $"Expected TDEE[{i}] > TDEE[{i - 1}]");
        }
    }

    [Fact]
    public async Task MetabolicAnalyze_OrdersTargetCaloriesAcrossCutRecompAndLeanBulk()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var cut = await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 29, 78, 178, 17, "moderate", "cut")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions);

        var recomp = await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 29, 78, 178, 17, "moderate", "recomp")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions);

        var bulk = await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 29, 78, 178, 17, "moderate", "lean-bulk")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions);

        Assert.True(cut!.TargetCalories < recomp!.TargetCalories);
        Assert.True(recomp.TargetCalories < cut.Tdee);
        Assert.True(bulk!.TargetCalories > cut.Tdee);
        Assert.Equal("cut", cut.GoalNormalized);
        Assert.Equal("recomp", recomp.GoalNormalized);
        Assert.Equal("lean-bulk", bulk.GoalNormalized);
    }

    [Fact]
    public async Task MetabolicAnalyze_EnforcesMacroSumTo100AndSafeCaloricFloors()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var smallFemale = await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("female", 48, 44, 150, 24, "sedentary", "cut")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions);

        var smallMale = await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 52, 52, 160, 16, "sedentary", "cut")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions);

        Assert.True(smallFemale!.TargetCalories >= 1200);
        Assert.True(smallMale!.TargetCalories >= 1500);
        Assert.Equal(100, smallFemale.Macros.ProteinPct + smallFemale.Macros.CarbsPct + smallFemale.Macros.FatPct);
        Assert.Equal(100, smallMale.Macros.ProteinPct + smallMale.Macros.CarbsPct + smallMale.Macros.FatPct);
        Assert.True(smallMale.Macros.ProteinG >= 90);
    }

    [Fact]
    public async Task MetabolicAnalyze_Generates12WeekPeriodizedMesocycleWithDeloadDropsAndAcwrCap()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest(
                Sex: "male",
                Age: 29,
                WeightKg: 80,
                HeightCm: 179,
                BodyFatPct: 16,
                ActivityLevel: "athlete",
                Goal: "lean-bulk",
                DaysPerWeek: 5,
                ExperienceLevel: "advanced",
                Squat1RmKg: 180,
                Bench1RmKg: 130,
                Deadlift1RmKg: 220));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = (await resp.Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal(12, body.Mesocycle12Week.Count);
        Assert.Equal([4, 8, 12], body.Mesocycle12Week.Where(w => w.IsDeload).Select(w => w.Week).ToArray());
        Assert.True(body.PeakAcwr <= MetabolicAnalyzerService.MaxSafeAcwr);
        Assert.All(body.Mesocycle12Week, w => Assert.True(w.Acwr <= MetabolicAnalyzerService.MaxSafeAcwr));

        Assert.Equal(3, body.DeloadDropPcts.Count);
        Assert.All(body.DeloadDropPcts, drop => Assert.InRange(drop, -45.0, -35.0));

        // Verify barbell plate rounding (multiples of 2.5 kg)
        Assert.All(body.Mesocycle12Week, w =>
        {
            Assert.Equal(0, w.SquatLoadKg % 2.5);
            Assert.Equal(0, w.BenchLoadKg % 2.5);
            Assert.Equal(0, w.DeadliftLoadKg % 2.5);
        });
    }

    [Fact]
    public async Task MetabolicAnalyze_CutVsLeanBulk_ProducesDistinct12WeekBodyCompositionTrajectories()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var cut = (await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 28, 82, 180, 20, "moderate", "cut")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        var bulk = (await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 28, 82, 180, 20, "moderate", "lean-bulk")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.True(cut.Mesocycle12Week[^1].ProjectedWeightKg < 80.0);
        Assert.True(cut.Mesocycle12Week[^1].ProjectedBodyFatPct < 17.5);
        Assert.True(bulk.Mesocycle12Week[^1].ProjectedWeightKg > 84.0);
        Assert.True(bulk.Mesocycle12Week[^1].ProjectedLeanMassKg > bulk.Mesocycle12Week[0].ProjectedLeanMassKg);
    }

    [Theory]
    [InlineData("other", 28, 78, 178, 18, "moderate", "cut")]
    [InlineData("male", 10, 78, 178, 18, "moderate", "cut")]
    [InlineData("male", 28, -5, 178, 18, "moderate", "cut")]
    [InlineData("male", 28, 78, 178, 18, "unknown_act", "cut")]
    [InlineData("male", 28, 78, 178, 18, "moderate", "invalid_goal")]
    public async Task MetabolicAnalyze_InvalidPayload_Returns400BadRequest(
        string sex,
        int age,
        double weightKg,
        double heightCm,
        double bodyFatPct,
        string activityLevel,
        string goal)
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest(sex, age, weightKg, heightCm, bodyFatPct, activityLevel, goal));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task MetabolicAnalyze_HydrationAndSodiumScaleWithActivityLevel()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var sedentary = (await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 29, 78, 178, 16, "sedentary", "recomp")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        var elite = (await (await client.PostAsJsonAsync(
            "/api/v1/metabolic/analyze",
            new MetabolicAnalyzeRequest("male", 29, 78, 178, 16, "elite", "recomp")))
            .Content.ReadFromJsonAsync<MetabolicAnalyzeResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.True(elite.HydrationLiters > sedentary.HydrationLiters);
        Assert.True(elite.ElectrolyteSodiumMg > sedentary.ElectrolyteSodiumMg);
    }
}
