using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Vanguard.Domain.Models;
using Vanguard.Domain.Services;

namespace Vanguard.Api.Tests;

public sealed class VanguardWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly IReadOnlyList<StudioClassSeed>? _customSeeds;

    public static JsonSerializerOptions JsonOptions { get; } = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public VanguardWebApplicationFactory(IReadOnlyList<StudioClassSeed>? customSeeds = null)
    {
        _customSeeds = customSeeds;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IClassBookingEngine>();
            services.AddSingleton<IClassBookingEngine>(_ =>
                _customSeeds is null
                    ? new AtomicClassBookingService()
                    : new AtomicClassBookingService(_customSeeds));
        });
    }
}
