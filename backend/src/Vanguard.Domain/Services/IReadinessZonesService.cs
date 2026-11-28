using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

public interface IReadinessZonesService
{
    (ReadinessZonesResponse? Result, string? ValidationError) Compute(ReadinessZonesRequest request);
}
