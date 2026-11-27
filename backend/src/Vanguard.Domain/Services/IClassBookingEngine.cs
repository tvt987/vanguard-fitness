using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

public interface IClassBookingEngine
{
    IReadOnlyList<StudioClassSummary> ListClasses(string? discipline = null);
    StudioClassDetail? GetClassDetail(string classId);
    Task<BookClassOutcome> BookAsync(
        string classId,
        BookClassRequest request,
        string? idempotencyKey,
        CancellationToken cancellationToken = default);
    Task<CancelBookingOutcome> CancelAsync(
        string classId,
        string bookingId,
        CancellationToken cancellationToken = default);
}
