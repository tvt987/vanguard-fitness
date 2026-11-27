using System.Net;
using System.Net.Http.Json;
using Vanguard.Domain.Models;
using Xunit;

namespace Vanguard.Api.Tests;

public sealed class ClassBookingConcurrencyTests
{
    private sealed record BookApiResponse(
        BookingRecord Booking,
        StudioClassSummary ClassSnapshot,
        bool IdempotentReplay);

    private sealed record CancelApiResponse(
        string CancelledBookingId,
        string ClassId,
        BookingStatus PreviousStatus,
        BookingRecord? PromotedBooking,
        IReadOnlyList<WaitlistEntryView> UpdatedWaitlist,
        StudioClassSummary ClassSnapshot);

    private sealed record ClassesListResponse(
        int Count,
        IReadOnlyList<StudioClassSummary> Classes);

    private static HttpRequestMessage CreateBookRequest(
        string classId,
        BookClassRequest body,
        string? idempotencyKey)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/classes/{classId}/book")
        {
            Content = JsonContent.Create(body),
        };
        if (idempotencyKey is not null)
        {
            req.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        return req;
    }

    [Fact]
    public async Task Concurrent10WayLastSpotRace_AllowWaitlistFalse_StrictlyOneCreatedAndNineConflicts()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("race-strict-01", "Barbell Force Vault", "strength_barbell", "mon", "18:30", 60, "Minh Khoa", "Iron Vault", "High", 12, 11, 0),
        ]);
        using var client = factory.CreateClient();

        var tasks = Enumerable.Range(1, 10).Select(async i =>
        {
            using var req = CreateBookRequest(
                "race-strict-01",
                new BookClassRequest($"mem-{i:D2}", $"Athlete {i}", AllowWaitlist: false),
                $"strict-race-key-{i:D2}");
            var resp = await client.SendAsync(req);
            BookApiResponse? body = null;
            if (resp.StatusCode == HttpStatusCode.Created)
            {
                body = await resp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions);
            }

            return (resp.StatusCode, body);
        });

        var results = await Task.WhenAll(tasks);

        var created = results.Where(r => r.StatusCode == HttpStatusCode.Created).ToList();
        var conflicts = results.Where(r => r.StatusCode == HttpStatusCode.Conflict).ToList();

        Assert.Single(created);
        Assert.Equal(9, conflicts.Count);
        Assert.Equal(BookingStatus.CONFIRMED, created[0].body!.Booking.Status);
        Assert.Null(created[0].body!.Booking.WaitlistPosition);

        var detail = await client.GetFromJsonAsync<StudioClassDetail>(
            "/api/v1/classes/race-strict-01",
            VanguardWebApplicationFactory.JsonOptions);
        Assert.NotNull(detail);
        Assert.Equal(12, detail.Summary.EnrolledCount);
        Assert.Equal(0, detail.Summary.RemainingSpots);
        Assert.Equal(0, detail.Summary.WaitlistCount);
    }

    [Fact]
    public async Task Concurrent10WayLastSpotRace_AllowWaitlistTrue_StrictlyOneConfirmedAndNineSequentialFifoWaitlisted()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("race-fifo-01", "VO2 Max MetCon Lab", "hiit_lab", "mon", "06:30", 45, "Marcus Reed", "Turf Lab", "Peak", 10, 9, 0),
        ]);
        using var client = factory.CreateClient();

        var tasks = Enumerable.Range(1, 10).Select(async i =>
        {
            using var req = CreateBookRequest(
                "race-fifo-01",
                new BookClassRequest($"runner-{i:D2}", $"Runner {i}", AllowWaitlist: true),
                $"fifo-race-key-{i:D2}");
            var resp = await client.SendAsync(req);
            var body = await resp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions);
            return (resp.StatusCode, body: body!);
        });

        var results = await Task.WhenAll(tasks);

        var confirmed = results.Where(r => r.StatusCode == HttpStatusCode.Created).ToList();
        var waitlisted = results.Where(r => r.StatusCode == HttpStatusCode.Accepted).ToList();

        Assert.Single(confirmed);
        Assert.Equal(9, waitlisted.Count);
        Assert.Equal(BookingStatus.CONFIRMED, confirmed[0].body.Booking.Status);
        Assert.Null(confirmed[0].body.Booking.WaitlistPosition);

        var positions = waitlisted
            .Select(w => w.body.Booking.WaitlistPosition)
            .OrderBy(p => p)
            .ToList();
        Assert.Equal(Enumerable.Range(1, 9).Select(p => (int?)p).ToList(), positions);
        Assert.All(waitlisted, w => Assert.Equal(BookingStatus.WAITLISTED, w.body.Booking.Status));

        var detail = await client.GetFromJsonAsync<StudioClassDetail>(
            "/api/v1/classes/race-fifo-01",
            VanguardWebApplicationFactory.JsonOptions);
        Assert.NotNull(detail);
        Assert.Equal(10, detail.Summary.EnrolledCount);
        Assert.Equal(9, detail.Summary.WaitlistCount);
        Assert.Equal(Enumerable.Range(1, 9).ToList(), detail.WaitlistQueue.Select(q => q.Position).ToList());
    }

    [Fact]
    public async Task CancelConfirmedMember_AutomaticallyPromotesFifoPosition1AndShiftsQueue()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("promo-01", "Kinetic Reformer Core", "reformer_pilates", "mon", "08:00", 50, "Claire Vu", "Pilates Atelier", "Moderate", 2, 1, 0),
        ]);
        using var client = factory.CreateClient();

        // Book last confirmed spot + 3 FIFO waitlisted members sequentially
        BookApiResponse confirmedResp;
        using (var r0 = CreateBookRequest("promo-01", new BookClassRequest("m-confirmed", "Alice Confirmed", true), "k-0"))
        {
            var res = await client.SendAsync(r0);
            Assert.Equal(HttpStatusCode.Created, res.StatusCode);
            confirmedResp = (await res.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        }

        var waitlistedMembers = new List<BookingRecord>();
        for (var i = 1; i <= 3; i++)
        {
            using var rw = CreateBookRequest("promo-01", new BookClassRequest($"m-wl-{i}", $"Waitlist Member {i}", true), $"k-wl-{i}");
            var res = await client.SendAsync(rw);
            Assert.Equal(HttpStatusCode.Accepted, res.StatusCode);
            var body = (await res.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;
            Assert.Equal(i, body.Booking.WaitlistPosition);
            waitlistedMembers.Add(body.Booking);
        }

        // Cancel confirmed booking -> FIFO #1 must promote to CONFIRMED, #2 -> #1, #3 -> #2
        var cancelResp = await client.DeleteAsync($"/api/v1/classes/promo-01/bookings/{confirmedResp.Booking.BookingId}");
        Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);
        var cancelBody = (await cancelResp.Content.ReadFromJsonAsync<CancelApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal(confirmedResp.Booking.BookingId, cancelBody.CancelledBookingId);
        Assert.Equal(BookingStatus.CONFIRMED, cancelBody.PreviousStatus);
        Assert.NotNull(cancelBody.PromotedBooking);
        Assert.Equal("m-wl-1", cancelBody.PromotedBooking.MemberId);
        Assert.Equal(BookingStatus.CONFIRMED, cancelBody.PromotedBooking.Status);
        Assert.Null(cancelBody.PromotedBooking.WaitlistPosition);
        Assert.NotNull(cancelBody.PromotedBooking.PromotedAtUtc);

        Assert.Equal(2, cancelBody.ClassSnapshot.EnrolledCount);
        Assert.Equal(2, cancelBody.ClassSnapshot.WaitlistCount);
        Assert.Equal(2, cancelBody.UpdatedWaitlist.Count);
        Assert.Equal("m-wl-2", cancelBody.UpdatedWaitlist[0].MemberId);
        Assert.Equal(1, cancelBody.UpdatedWaitlist[0].Position);
        Assert.Equal("m-wl-3", cancelBody.UpdatedWaitlist[1].MemberId);
        Assert.Equal(2, cancelBody.UpdatedWaitlist[1].Position);
    }

    [Fact]
    public async Task SequentialDoubleCancellation_PromotesSecondWaitlistedMemberInOrder()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("promo-02", "Iron Vault", "strength_barbell", "wed", "06:30", 60, "Duc Anh", "Iron Vault", "High", 1, 0, 0),
        ]);
        using var client = factory.CreateClient();

        using var r1 = CreateBookRequest("promo-02", new BookClassRequest("a1", "Alpha", true), "d-1");
        var b1 = (await (await client.SendAsync(r1)).Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!.Booking;

        using var r2 = CreateBookRequest("promo-02", new BookClassRequest("a2", "Beta", true), "d-2");
        var b2 = (await (await client.SendAsync(r2)).Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!.Booking;

        using var r3 = CreateBookRequest("promo-02", new BookClassRequest("a3", "Gamma", true), "d-3");
        _ = await client.SendAsync(r3);

        // Cancel Alpha -> Beta promoted
        var c1 = await (await client.DeleteAsync($"/api/v1/classes/promo-02/bookings/{b1.BookingId}"))
            .Content.ReadFromJsonAsync<CancelApiResponse>(VanguardWebApplicationFactory.JsonOptions);
        Assert.Equal("a2", c1!.PromotedBooking!.MemberId);

        // Cancel Beta -> Gamma promoted
        var c2 = await (await client.DeleteAsync($"/api/v1/classes/promo-02/bookings/{b2.BookingId}"))
            .Content.ReadFromJsonAsync<CancelApiResponse>(VanguardWebApplicationFactory.JsonOptions);
        Assert.Equal("a3", c2!.PromotedBooking!.MemberId);
        Assert.Empty(c2.UpdatedWaitlist);
        Assert.Equal(1, c2.ClassSnapshot.EnrolledCount);
    }

    [Fact]
    public async Task CancelMiddleWaitlistedMember_CompactsSubsequentQueuePositionsWithoutAffectingConfirmed()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("mid-wl-01", "Cryo Sanctuary", "cryo_recovery", "wed", "18:00", 45, "Hana Tran", "Basalt Sanctuary", "Low", 2, 2, 0),
        ]);
        using var client = factory.CreateClient();

        var bookings = new List<BookingRecord>();
        for (var i = 1; i <= 3; i++)
        {
            using var req = CreateBookRequest("mid-wl-01", new BookClassRequest($"w{i}", $"Waiter {i}", true), $"mw-{i}");
            var resp = await client.SendAsync(req);
            Assert.Equal(HttpStatusCode.Accepted, resp.StatusCode);
            bookings.Add((await resp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!.Booking);
        }

        var del = await client.DeleteAsync($"/api/v1/classes/mid-wl-01/bookings/{bookings[1].BookingId}");
        Assert.Equal(HttpStatusCode.OK, del.StatusCode);
        var body = (await del.Content.ReadFromJsonAsync<CancelApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Equal(BookingStatus.WAITLISTED, body.PreviousStatus);
        Assert.Null(body.PromotedBooking);
        Assert.Equal(2, body.ClassSnapshot.EnrolledCount);
        Assert.Equal(2, body.UpdatedWaitlist.Count);
        Assert.Equal("w1", body.UpdatedWaitlist[0].MemberId);
        Assert.Equal(1, body.UpdatedWaitlist[0].Position);
        Assert.Equal("w3", body.UpdatedWaitlist[1].MemberId);
        Assert.Equal(2, body.UpdatedWaitlist[1].Position);
    }

    [Fact]
    public async Task CancelConfirmedMemberWithEmptyWaitlist_OpensRemainingSpot()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("open-01", "Strength Clinic", "strength_barbell", "fri", "06:45", 60, "Minh Khoa", "Iron Vault", "High", 4, 3, 0),
        ]);
        using var client = factory.CreateClient();

        using var bookReq = CreateBookRequest("open-01", new BookClassRequest("solo-1", "Solo Lifter", true), "solo-k1");
        var bookResp = await client.SendAsync(bookReq);
        Assert.Equal(HttpStatusCode.Created, bookResp.StatusCode);
        var booked = (await bookResp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        Assert.Equal(0, booked.ClassSnapshot.RemainingSpots);

        var cancelResp = await client.DeleteAsync($"/api/v1/classes/open-01/bookings/{booked.Booking.BookingId}");
        Assert.Equal(HttpStatusCode.OK, cancelResp.StatusCode);
        var cancelled = (await cancelResp.Content.ReadFromJsonAsync<CancelApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.Null(cancelled.PromotedBooking);
        Assert.Equal(3, cancelled.ClassSnapshot.EnrolledCount);
        Assert.Equal(1, cancelled.ClassSnapshot.RemainingSpots);
    }

    [Fact]
    public async Task IdempotentRetry_IdenticalKeyAndPayload_Replays200OkWithoutDoubleBooking()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var payload = new BookClassRequest("idem-user-1", "Minh Anh", AllowWaitlist: true);
        using var req1 = CreateBookRequest("mon-0630-hiit", payload, "idem-key-100");
        var resp1 = await client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);
        var body1 = (await resp1.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        using var req2 = CreateBookRequest("mon-0630-hiit", payload, "idem-key-100");
        var resp2 = await client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        Assert.True(resp2.Headers.TryGetValues("Idempotency-Replayed", out var vals) && vals.Contains("true"));
        var body2 = (await resp2.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;

        Assert.True(body2.IdempotentReplay);
        Assert.Equal(body1.Booking.BookingId, body2.Booking.BookingId);
        Assert.Equal(body1.ClassSnapshot.EnrolledCount, body2.ClassSnapshot.EnrolledCount);
    }

    [Fact]
    public async Task IdempotentRetry_SameKeyWithDifferentPayload_Returns409Conflict()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        using var req1 = CreateBookRequest("mon-0630-hiit", new BookClassRequest("u-1", "Member One", true), "shared-key-01");
        var resp1 = await client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        using var req2 = CreateBookRequest("mon-0630-hiit", new BookClassRequest("u-2", "Member Two", true), "shared-key-01");
        var resp2 = await client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task ConcurrentDuplicateIdempotencyKey_ConsumesStrictlyOneSpot()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("dup-race-01", "Olympic Lab", "strength_barbell", "wed", "06:30", 60, "Duc Anh", "Iron Vault", "High", 10, 5, 0),
        ]);
        using var client = factory.CreateClient();

        var tasks = Enumerable.Range(0, 5).Select(async _ =>
        {
            using var req = CreateBookRequest("dup-race-01", new BookClassRequest("same-mem", "Same Athlete", true), "single-key-race");
            var resp = await client.SendAsync(req);
            var body = await resp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions);
            return (resp.StatusCode, body: body!);
        });

        var results = await Task.WhenAll(tasks);

        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(4, results.Count(r => r.StatusCode == HttpStatusCode.OK && r.body.IdempotentReplay));
        Assert.Single(results.Select(r => r.body.Booking.BookingId).Distinct());

        var detail = await client.GetFromJsonAsync<StudioClassDetail>(
            "/api/v1/classes/dup-race-01",
            VanguardWebApplicationFactory.JsonOptions);
        Assert.Equal(6, detail!.Summary.EnrolledCount);
    }

    [Fact]
    public async Task IdempotentReplayForWaitlistedBooking_Returns200WithSamePosition()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var payload = new BookClassRequest("wl-idem-1", "Waitlist Replay", AllowWaitlist: true);
        using var req1 = CreateBookRequest("mon-0800-pilates", payload, "wl-idem-key");
        var resp1 = await client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Accepted, resp1.StatusCode);
        var body1 = (await resp1.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        Assert.Equal(3, body1.Booking.WaitlistPosition);

        using var req2 = CreateBookRequest("mon-0800-pilates", payload, "wl-idem-key");
        var resp2 = await client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var body2 = (await resp2.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions))!;
        Assert.Equal(body1.Booking.BookingId, body2.Booking.BookingId);
        Assert.Equal(3, body2.Booking.WaitlistPosition);
        Assert.Equal(3, body2.ClassSnapshot.WaitlistCount);
    }

    [Fact]
    public async Task MissingIdempotencyKeyHeader_Returns400BadRequest()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        using var req = CreateBookRequest("mon-0630-hiit", new BookClassRequest("u-nokey", "No Key", true), null);
        var resp = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task DuplicateActiveMemberWithDifferentIdempotencyKey_Returns409Conflict()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        using var req1 = CreateBookRequest("mon-0630-hiit", new BookClassRequest("dup-mem-01", "Repeat Member", true), "k-first");
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(req1)).StatusCode);

        using var req2 = CreateBookRequest("mon-0630-hiit", new BookClassRequest("dup-mem-01", "Repeat Member", true), "k-second");
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(req2)).StatusCode);
    }

    [Fact]
    public async Task UnknownClassOrBookingId_Returns404NotFound()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        using var bookUnknown = CreateBookRequest("does-not-exist", new BookClassRequest("m1", "Test", true), "k-404");
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(bookUnknown)).StatusCode);

        var cancelUnknownClass = await client.DeleteAsync("/api/v1/classes/does-not-exist/bookings/bk-123");
        Assert.Equal(HttpStatusCode.NotFound, cancelUnknownClass.StatusCode);

        var cancelUnknownBooking = await client.DeleteAsync("/api/v1/classes/mon-0630-hiit/bookings/bk-nonexistent");
        Assert.Equal(HttpStatusCode.NotFound, cancelUnknownBooking.StatusCode);
    }

    [Fact]
    public async Task CrossClassIsolation_BookingClassADoesNotMutateClassB()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var before = await client.GetFromJsonAsync<StudioClassDetail>(
            "/api/v1/classes/tue-0700-cryo",
            VanguardWebApplicationFactory.JsonOptions);

        using var req = CreateBookRequest("mon-0630-hiit", new BookClassRequest("iso-1", "Isolated Athlete", true), "iso-k1");
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(req)).StatusCode);

        var after = await client.GetFromJsonAsync<StudioClassDetail>(
            "/api/v1/classes/tue-0700-cryo",
            VanguardWebApplicationFactory.JsonOptions);

        Assert.Equal(before!.Summary.EnrolledCount, after!.Summary.EnrolledCount);
        Assert.Equal(before.Summary.WaitlistCount, after.Summary.WaitlistCount);
    }

    [Fact]
    public async Task Concurrent20MemberBurstOnFullClass_ProducesStrictlyMonotonicFifoPositions1Through20()
    {
        using var factory = new VanguardWebApplicationFactory(
        [
            new("burst-20", "Peak HYROX Class", "hiit_lab", "sat", "08:30", 55, "Linh Nguyen", "Turf Lab", "Peak", 10, 10, 0),
        ]);
        using var client = factory.CreateClient();

        var tasks = Enumerable.Range(1, 20).Select(async i =>
        {
            using var req = CreateBookRequest("burst-20", new BookClassRequest($"b-{i:D2}", $"Burst {i}", true), $"bk-{i:D2}");
            var resp = await client.SendAsync(req);
            var body = await resp.Content.ReadFromJsonAsync<BookApiResponse>(VanguardWebApplicationFactory.JsonOptions);
            return (resp.StatusCode, body!.Booking.WaitlistPosition);
        });

        var results = await Task.WhenAll(tasks);

        Assert.All(results, r => Assert.Equal(HttpStatusCode.Accepted, r.StatusCode));
        var positions = results.Select(r => r.WaitlistPosition!.Value).OrderBy(x => x).ToList();
        Assert.Equal(Enumerable.Range(1, 20).ToList(), positions);
    }

    [Fact]
    public async Task ListClassesEndpoint_ReturnsFullScheduleAndSupportsDisciplineFiltering()
    {
        using var factory = new VanguardWebApplicationFactory();
        using var client = factory.CreateClient();

        var allResp = await client.GetFromJsonAsync<ClassesListResponse>(
            "/api/v1/classes",
            VanguardWebApplicationFactory.JsonOptions);
        Assert.NotNull(allResp);
        Assert.True(allResp.Count >= 8);
        Assert.All(allResp.Classes, c =>
        {
            Assert.False(string.IsNullOrWhiteSpace(c.Coach));
            Assert.False(string.IsNullOrWhiteSpace(c.StudioZone));
            Assert.True(c.Capacity > 0);
            Assert.Equal(Math.Max(0, c.Capacity - c.EnrolledCount), c.RemainingSpots);
        });

        var pilatesResp = await client.GetFromJsonAsync<ClassesListResponse>(
            "/api/v1/classes?discipline=reformer_pilates",
            VanguardWebApplicationFactory.JsonOptions);
        Assert.NotNull(pilatesResp);
        Assert.NotEmpty(pilatesResp.Classes);
        Assert.All(pilatesResp.Classes, c => Assert.Equal("reformer_pilates", c.Discipline));
    }
}
