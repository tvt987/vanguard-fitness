using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Vanguard.Domain.Models;

namespace Vanguard.Domain.Services;

/// <summary>
/// Thread-safe, per-class atomic capacity lock and FIFO waitlist promotion engine.
/// Uses fine-grained SemaphoreSlim locks keyed by classId so independent classes scale concurrently
/// while protecting every seat allocation, idempotent replay, and waitlist promotion against race conditions.
/// </summary>
public sealed class AtomicClassBookingService : IClassBookingEngine, IDisposable
{
    private sealed class IdempotencyEntry
    {
        public required string PayloadFingerprint { get; init; }
        public required int OriginalStatusCode { get; init; }
        public required BookingRecord Booking { get; init; }
    }

    private sealed class ClassBucket : IDisposable
    {
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public required StudioClassSeed Metadata { get; init; }
        public Dictionary<string, BookingRecord> ConfirmedBookings { get; } = new(StringComparer.Ordinal);
        public List<BookingRecord> WaitlistQueue { get; } = [];
        public Dictionary<string, IdempotencyEntry> IdempotencyLedger { get; } = new(StringComparer.Ordinal);

        public StudioClassSummary ToSummary()
        {
            var enrolled = ConfirmedBookings.Count;
            var remaining = Math.Max(0, Metadata.Capacity - enrolled);
            return new StudioClassSummary(
                ClassId: Metadata.ClassId,
                Title: Metadata.Title,
                Discipline: Metadata.Discipline,
                DayOfWeek: Metadata.DayOfWeek,
                StartTime: Metadata.StartTime,
                DurationMin: Metadata.DurationMin,
                Coach: Metadata.Coach,
                StudioZone: Metadata.StudioZone,
                Intensity: Metadata.Intensity,
                Capacity: Metadata.Capacity,
                EnrolledCount: enrolled,
                RemainingSpots: remaining,
                WaitlistCount: WaitlistQueue.Count,
                IsFull: remaining == 0);
        }

        public IReadOnlyList<WaitlistEntryView> BuildWaitlistView() =>
            WaitlistQueue
                .Select((b, index) => new WaitlistEntryView(
                    BookingId: b.BookingId,
                    MemberId: b.MemberId,
                    MemberName: b.MemberName,
                    Position: index + 1,
                    QueuedAtUtc: b.CreatedAtUtc))
                .ToList();

        public void Dispose() => Gate.Dispose();
    }

    private readonly ConcurrentDictionary<string, ClassBucket> _classes = new(StringComparer.OrdinalIgnoreCase);

    public AtomicClassBookingService()
        : this(DefaultScheduleSeeds)
    {
    }

    public AtomicClassBookingService(IEnumerable<StudioClassSeed> seeds)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var seed in seeds)
        {
            var bucket = new ClassBucket { Metadata = seed };

            var clampedEnrolled = Math.Clamp(seed.InitialEnrolledCount, 0, seed.Capacity);
            for (var i = 1; i <= clampedEnrolled; i++)
            {
                var bookingId = $"seed-{seed.ClassId}-c{i:D2}";
                bucket.ConfirmedBookings[bookingId] = new BookingRecord(
                    BookingId: bookingId,
                    ClassId: seed.ClassId,
                    MemberId: $"member-seed-{seed.ClassId}-{i:D2}",
                    MemberName: $"Vanguard Member #{i:D2}",
                    Status: BookingStatus.CONFIRMED,
                    WaitlistPosition: null,
                    IdempotencyKey: $"seed-key-{bookingId}",
                    CreatedAtUtc: now.AddMinutes(-30 + i));
            }

            for (var j = 1; j <= Math.Max(0, seed.InitialWaitlistCount); j++)
            {
                var bookingId = $"seed-{seed.ClassId}-w{j:D2}";
                bucket.WaitlistQueue.Add(new BookingRecord(
                    BookingId: bookingId,
                    ClassId: seed.ClassId,
                    MemberId: $"member-waitlist-{seed.ClassId}-{j:D2}",
                    MemberName: $"Waitlisted Athlete #{j:D2}",
                    Status: BookingStatus.WAITLISTED,
                    WaitlistPosition: j,
                    IdempotencyKey: $"seed-key-{bookingId}",
                    CreatedAtUtc: now.AddMinutes(-10 + j)));
            }

            _classes[seed.ClassId] = bucket;
        }
    }

    public static IReadOnlyList<StudioClassSeed> DefaultScheduleSeeds { get; } =
    [
        new("mon-0630-hiit", "VO2 Max MetCon Lab", "hiit_lab", "mon", "06:30", 45, "Marcus Reed", "Turf Lab · Floor 2", "Peak", 14, 12, 0),
        new("mon-0800-pilates", "Kinetic Reformer Core", "reformer_pilates", "mon", "08:00", 50, "Claire Vu", "Pilates Atelier · Floor 3", "Moderate", 10, 10, 2),
        new("mon-1830-strength", "Barbell Force & Hypertrophy", "strength_barbell", "mon", "18:30", 60, "Minh Khoa", "Iron Vault · Floor 1", "High", 12, 11, 0),
        new("tue-0700-cryo", "Contrast Plunge 4.8C + Infrared", "cryo_recovery", "tue", "07:00", 40, "Hana Tran", "Basalt Sanctuary · Floor 4", "Low", 8, 6, 0),
        new("wed-0630-strength", "Olympic Lifting Velocity Lab", "strength_barbell", "wed", "06:30", 60, "Duc Anh", "Iron Vault · Floor 1", "High", 10, 9, 0),
        new("wed-1800-cryo", "HRV Breathwork & Cold Immersion", "cryo_recovery", "wed", "18:00", 45, "Hana Tran", "Basalt Sanctuary · Floor 4", "Low", 8, 8, 1),
        new("thu-0730-pilates", "Athletic Reformer Power", "reformer_pilates", "thu", "07:30", 50, "Claire Vu", "Pilates Atelier · Floor 3", "High", 10, 7, 0),
        new("sat-0830-hiit", "HYROX Simulation Partner Circuit", "hiit_lab", "sat", "08:30", 55, "Linh Nguyen", "Turf Lab · Floor 2", "Peak", 16, 15, 0),
    ];

    public IReadOnlyList<StudioClassSummary> ListClasses(string? discipline = null)
    {
        var list = new List<StudioClassSummary>();
        foreach (var bucket in _classes.Values)
        {
            if (!string.IsNullOrWhiteSpace(discipline) &&
                !discipline.Equals("all", StringComparison.OrdinalIgnoreCase) &&
                !bucket.Metadata.Discipline.Equals(discipline.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            bucket.Gate.Wait();
            try
            {
                list.Add(bucket.ToSummary());
            }
            finally
            {
                bucket.Gate.Release();
            }
        }

        return list
            .OrderBy(c => c.ClassId, StringComparer.Ordinal)
            .ToList();
    }

    public StudioClassDetail? GetClassDetail(string classId)
    {
        if (!_classes.TryGetValue(classId, out var bucket))
        {
            return null;
        }

        bucket.Gate.Wait();
        try
        {
            return new StudioClassDetail(bucket.ToSummary(), bucket.BuildWaitlistView());
        }
        finally
        {
            bucket.Gate.Release();
        }
    }

    public async Task<BookClassOutcome> BookAsync(
        string classId,
        BookClassRequest request,
        string? idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return new BookClassOutcome(
                StatusCode: 400,
                IsIdempotentReplay: false,
                ErrorCode: "IDEMPOTENCY_KEY_REQUIRED",
                ErrorDetail: "The Idempotency-Key HTTP header is mandatory for class capacity lock bookings.",
                Booking: null,
                ClassSnapshot: null);
        }

        if (string.IsNullOrWhiteSpace(request.MemberId) || string.IsNullOrWhiteSpace(request.MemberName))
        {
            return new BookClassOutcome(
                StatusCode: 400,
                IsIdempotentReplay: false,
                ErrorCode: "INVALID_MEMBER_PAYLOAD",
                ErrorDetail: "Both memberId and memberName are required.",
                Booking: null,
                ClassSnapshot: null);
        }

        if (!_classes.TryGetValue(classId, out var bucket))
        {
            return new BookClassOutcome(
                StatusCode: 404,
                IsIdempotentReplay: false,
                ErrorCode: "CLASS_NOT_FOUND",
                ErrorDetail: $"Studio class '{classId}' was not found.",
                Booking: null,
                ClassSnapshot: null);
        }

        var normalizedKey = idempotencyKey.Trim();
        var normalizedMemberId = request.MemberId.Trim();
        var normalizedMemberName = request.MemberName.Trim();
        var fingerprint = ComputePayloadFingerprint(
            bucket.Metadata.ClassId,
            normalizedMemberId,
            normalizedMemberName,
            request.AllowWaitlist);

        await bucket.Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            // 1. Idempotency check inside the atomic critical section
            if (bucket.IdempotencyLedger.TryGetValue(normalizedKey, out var existingEntry))
            {
                if (!string.Equals(existingEntry.PayloadFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    return new BookClassOutcome(
                        StatusCode: 409,
                        IsIdempotentReplay: false,
                        ErrorCode: "IDEMPOTENCY_PAYLOAD_MISMATCH",
                        ErrorDetail: "The supplied Idempotency-Key was previously used with a different booking payload.",
                        Booking: null,
                        ClassSnapshot: bucket.ToSummary());
                }

                // Return the latest state of that booking if it was promoted, otherwise original booking
                var latestBooking = ResolveCurrentBooking(bucket, existingEntry.Booking);
                return new BookClassOutcome(
                    StatusCode: 200,
                    IsIdempotentReplay: true,
                    ErrorCode: null,
                    ErrorDetail: null,
                    Booking: latestBooking,
                    ClassSnapshot: bucket.ToSummary());
            }

            // 2. Prevent duplicate active booking by the same memberId with a different key
            var alreadyConfirmed = bucket.ConfirmedBookings.Values.Any(b =>
                b.MemberId.Equals(normalizedMemberId, StringComparison.OrdinalIgnoreCase));
            var alreadyWaitlisted = bucket.WaitlistQueue.Any(b =>
                b.MemberId.Equals(normalizedMemberId, StringComparison.OrdinalIgnoreCase));

            if (alreadyConfirmed || alreadyWaitlisted)
            {
                return new BookClassOutcome(
                    StatusCode: 409,
                    IsIdempotentReplay: false,
                    ErrorCode: "MEMBER_ALREADY_BOOKED",
                    ErrorDetail: $"Member '{normalizedMemberId}' already holds an active booking or waitlist position for class '{bucket.Metadata.ClassId}'.",
                    Booking: null,
                    ClassSnapshot: bucket.ToSummary());
            }

            var now = DateTimeOffset.UtcNow;
            var bookingId = $"bk-{Guid.NewGuid():N}"[..15];

            // 3. Atomic capacity check: allocate mat OR route to FIFO waitlist OR reject 409
            if (bucket.ConfirmedBookings.Count < bucket.Metadata.Capacity)
            {
                var confirmed = new BookingRecord(
                    BookingId: bookingId,
                    ClassId: bucket.Metadata.ClassId,
                    MemberId: normalizedMemberId,
                    MemberName: normalizedMemberName,
                    Status: BookingStatus.CONFIRMED,
                    WaitlistPosition: null,
                    IdempotencyKey: normalizedKey,
                    CreatedAtUtc: now);

                bucket.ConfirmedBookings[bookingId] = confirmed;
                bucket.IdempotencyLedger[normalizedKey] = new IdempotencyEntry
                {
                    PayloadFingerprint = fingerprint,
                    OriginalStatusCode = 201,
                    Booking = confirmed,
                };

                return new BookClassOutcome(
                    StatusCode: 201,
                    IsIdempotentReplay: false,
                    ErrorCode: null,
                    ErrorDetail: null,
                    Booking: confirmed,
                    ClassSnapshot: bucket.ToSummary());
            }

            if (!request.AllowWaitlist)
            {
                return new BookClassOutcome(
                    StatusCode: 409,
                    IsIdempotentReplay: false,
                    ErrorCode: "CLASS_AT_CAPACITY",
                    ErrorDetail: $"Class '{bucket.Metadata.ClassId}' is at full capacity ({bucket.Metadata.Capacity}/{bucket.Metadata.Capacity}) and allowWaitlist is false.",
                    Booking: null,
                    ClassSnapshot: bucket.ToSummary());
            }

            var fifoPosition = bucket.WaitlistQueue.Count + 1;
            var waitlisted = new BookingRecord(
                BookingId: bookingId,
                ClassId: bucket.Metadata.ClassId,
                MemberId: normalizedMemberId,
                MemberName: normalizedMemberName,
                Status: BookingStatus.WAITLISTED,
                WaitlistPosition: fifoPosition,
                IdempotencyKey: normalizedKey,
                CreatedAtUtc: now);

            bucket.WaitlistQueue.Add(waitlisted);
            bucket.IdempotencyLedger[normalizedKey] = new IdempotencyEntry
            {
                PayloadFingerprint = fingerprint,
                OriginalStatusCode = 202,
                Booking = waitlisted,
            };

            return new BookClassOutcome(
                StatusCode: 202,
                IsIdempotentReplay: false,
                ErrorCode: null,
                ErrorDetail: null,
                Booking: waitlisted,
                ClassSnapshot: bucket.ToSummary());
        }
        finally
        {
            bucket.Gate.Release();
        }
    }

    public async Task<CancelBookingOutcome> CancelAsync(
        string classId,
        string bookingId,
        CancellationToken cancellationToken = default)
    {
        if (!_classes.TryGetValue(classId, out var bucket))
        {
            return new CancelBookingOutcome(
                StatusCode: 404,
                ErrorCode: "CLASS_NOT_FOUND",
                ErrorDetail: $"Studio class '{classId}' was not found.",
                CancelledBookingId: null,
                ClassId: classId,
                PreviousStatus: null,
                PromotedBooking: null,
                UpdatedWaitlist: [],
                ClassSnapshot: null);
        }

        await bucket.Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            // Case A: Cancelling a CONFIRMED member -> triggers automatic FIFO Waitlist #1 promotion
            if (bucket.ConfirmedBookings.Remove(bookingId))
            {
                BookingRecord? promoted = null;
                if (bucket.WaitlistQueue.Count > 0)
                {
                    var head = bucket.WaitlistQueue[0];
                    bucket.WaitlistQueue.RemoveAt(0);

                    promoted = head with
                    {
                        Status = BookingStatus.CONFIRMED,
                        WaitlistPosition = null,
                        PromotedAtUtc = DateTimeOffset.UtcNow,
                    };
                    bucket.ConfirmedBookings[promoted.BookingId] = promoted;

                    // Re-index remaining FIFO waitlist positions sequentially (#2 -> #1, #3 -> #2, ...)
                    for (var idx = 0; idx < bucket.WaitlistQueue.Count; idx++)
                    {
                        bucket.WaitlistQueue[idx] = bucket.WaitlistQueue[idx] with
                        {
                            WaitlistPosition = idx + 1,
                        };
                    }
                }

                return new CancelBookingOutcome(
                    StatusCode: 200,
                    ErrorCode: null,
                    ErrorDetail: null,
                    CancelledBookingId: bookingId,
                    ClassId: bucket.Metadata.ClassId,
                    PreviousStatus: BookingStatus.CONFIRMED,
                    PromotedBooking: promoted,
                    UpdatedWaitlist: bucket.BuildWaitlistView(),
                    ClassSnapshot: bucket.ToSummary());
            }

            // Case B: Cancelling a WAITLISTED member -> remove from FIFO queue and compact subsequent positions
            var waitlistIndex = bucket.WaitlistQueue.FindIndex(b =>
                b.BookingId.Equals(bookingId, StringComparison.Ordinal));

            if (waitlistIndex >= 0)
            {
                bucket.WaitlistQueue.RemoveAt(waitlistIndex);
                for (var idx = 0; idx < bucket.WaitlistQueue.Count; idx++)
                {
                    bucket.WaitlistQueue[idx] = bucket.WaitlistQueue[idx] with
                    {
                        WaitlistPosition = idx + 1,
                    };
                }

                return new CancelBookingOutcome(
                    StatusCode: 200,
                    ErrorCode: null,
                    ErrorDetail: null,
                    CancelledBookingId: bookingId,
                    ClassId: bucket.Metadata.ClassId,
                    PreviousStatus: BookingStatus.WAITLISTED,
                    PromotedBooking: null,
                    UpdatedWaitlist: bucket.BuildWaitlistView(),
                    ClassSnapshot: bucket.ToSummary());
            }

            return new CancelBookingOutcome(
                StatusCode: 404,
                ErrorCode: "BOOKING_NOT_FOUND",
                ErrorDetail: $"Active booking '{bookingId}' was not found in class '{bucket.Metadata.ClassId}'.",
                CancelledBookingId: null,
                ClassId: bucket.Metadata.ClassId,
                PreviousStatus: null,
                PromotedBooking: null,
                UpdatedWaitlist: bucket.BuildWaitlistView(),
                ClassSnapshot: bucket.ToSummary());
        }
        finally
        {
            bucket.Gate.Release();
        }
    }

    private static BookingRecord ResolveCurrentBooking(ClassBucket bucket, BookingRecord original)
    {
        if (bucket.ConfirmedBookings.TryGetValue(original.BookingId, out var confirmed))
        {
            return confirmed;
        }

        var waitlisted = bucket.WaitlistQueue.FirstOrDefault(b =>
            b.BookingId.Equals(original.BookingId, StringComparison.Ordinal));
        return waitlisted ?? original;
    }

    private static string ComputePayloadFingerprint(
        string classId,
        string memberId,
        string memberName,
        bool allowWaitlist)
    {
        var canonical = $"{classId.ToLowerInvariant()}|{memberId.ToLowerInvariant()}|{memberName}|{allowWaitlist}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return Convert.ToHexString(hash);
    }

    public void Dispose()
    {
        foreach (var bucket in _classes.Values)
        {
            bucket.Dispose();
        }
    }
}
