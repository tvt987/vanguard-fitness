using System.Text.Json.Serialization;

namespace Vanguard.Domain.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BookingStatus
{
    CONFIRMED,
    WAITLISTED,
    CANCELLED,
}

public sealed record StudioClassSummary(
    string ClassId,
    string Title,
    string Discipline,
    string DayOfWeek,
    string StartTime,
    int DurationMin,
    string Coach,
    string StudioZone,
    string Intensity,
    int Capacity,
    int EnrolledCount,
    int RemainingSpots,
    int WaitlistCount,
    bool IsFull);

public sealed record WaitlistEntryView(
    string BookingId,
    string MemberId,
    string MemberName,
    int Position,
    DateTimeOffset QueuedAtUtc);

public sealed record StudioClassDetail(
    StudioClassSummary Summary,
    IReadOnlyList<WaitlistEntryView> WaitlistQueue);

public sealed record BookingRecord(
    string BookingId,
    string ClassId,
    string MemberId,
    string MemberName,
    BookingStatus Status,
    int? WaitlistPosition,
    string IdempotencyKey,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? PromotedAtUtc = null);

public sealed record BookClassRequest(
    string MemberId,
    string MemberName,
    bool AllowWaitlist = true);

public sealed record BookClassOutcome(
    int StatusCode,
    bool IsIdempotentReplay,
    string? ErrorCode,
    string? ErrorDetail,
    BookingRecord? Booking,
    StudioClassSummary? ClassSnapshot);

public sealed record CancelBookingOutcome(
    int StatusCode,
    string? ErrorCode,
    string? ErrorDetail,
    string? CancelledBookingId,
    string? ClassId,
    BookingStatus? PreviousStatus,
    BookingRecord? PromotedBooking,
    IReadOnlyList<WaitlistEntryView> UpdatedWaitlist,
    StudioClassSummary? ClassSnapshot);

public sealed record StudioClassSeed(
    string ClassId,
    string Title,
    string Discipline,
    string DayOfWeek,
    string StartTime,
    int DurationMin,
    string Coach,
    string StudioZone,
    string Intensity,
    int Capacity,
    int InitialEnrolledCount,
    int InitialWaitlistCount);
