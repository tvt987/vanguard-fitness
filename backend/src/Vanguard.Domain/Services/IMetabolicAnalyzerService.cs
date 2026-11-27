using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

public interface IMetabolicAnalyzerService
{
    (MetabolicAnalyzeResponse? Result, string? ValidationError) Analyze(MetabolicAnalyzeRequest request);
}
