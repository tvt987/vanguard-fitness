using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Vanguard.Domain.Models;
using Vanguard.Domain.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("Idempotency-Replayed", "Location");
    });
});

builder.Services.AddSingleton<IClassBookingEngine, AtomicClassBookingService>();
builder.Services.AddSingleton<IMetabolicAnalyzerService, MetabolicAnalyzerService>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();

app.MapGet("/health", (IClassBookingEngine engine) =>
{
    var classes = engine.ListClasses();
    return Results.Ok(new
    {
        status = "healthy",
        service = "vanguard-api",
        version = "2.0.0",
        runtime = Environment.Version.ToString(),
        activeClasses = classes.Count,
        timestampUtc = DateTimeOffset.UtcNow,
    });
});

var v1 = app.MapGroup("/api/v1");

v1.MapGet("/classes", ([FromQuery] string? discipline, IClassBookingEngine engine) =>
{
    var schedule = engine.ListClasses(discipline);
    return Results.Ok(new
    {
        count = schedule.Count,
        classes = schedule,
    });
});

v1.MapGet("/classes/{classId}", (string classId, IClassBookingEngine engine) =>
{
    var detail = engine.GetClassDetail(classId);
    if (detail is null)
    {
        return Results.Problem(
            title: "Class not found",
            detail: $"Studio class '{classId}' was not found.",
            statusCode: StatusCodes.Status404NotFound);
    }

    return Results.Ok(detail);
});

v1.MapPost("/metabolic/analyze", (
    [FromBody] MetabolicAnalyzeRequest request,
    IMetabolicAnalyzerService analyzer) =>
{
    var (result, error) = analyzer.Analyze(request);
    if (error is not null || result is null)
    {
        return Results.Problem(
            title: "Invalid metabolic analysis request",
            detail: error ?? "Validation failed.",
            statusCode: StatusCodes.Status400BadRequest);
    }

    return Results.Ok(result);
});

v1.MapPost("/classes/{classId}/book", async (
    string classId,
    [FromBody] BookClassRequest request,
    HttpContext httpContext,
    IClassBookingEngine engine,
    CancellationToken ct) =>
{
    var idempotencyKey = httpContext.Request.Headers["Idempotency-Key"].FirstOrDefault();
    var outcome = await engine.BookAsync(classId, request, idempotencyKey, ct).ConfigureAwait(false);

    if (outcome.ErrorCode is not null)
    {
        return Results.Problem(
            title: outcome.ErrorCode,
            detail: outcome.ErrorDetail,
            statusCode: outcome.StatusCode,
            extensions: outcome.ClassSnapshot is not null
                ? new Dictionary<string, object?> { ["classSnapshot"] = outcome.ClassSnapshot }
                : null);
    }

    if (outcome.IsIdempotentReplay)
    {
        httpContext.Response.Headers["Idempotency-Replayed"] = "true";
    }

    var payload = new
    {
        booking = outcome.Booking,
        classSnapshot = outcome.ClassSnapshot,
        idempotentReplay = outcome.IsIdempotentReplay,
    };

    return outcome.StatusCode switch
    {
        StatusCodes.Status201Created => Results.Created(
            $"/api/v1/classes/{classId}/bookings/{outcome.Booking!.BookingId}",
            payload),
        StatusCodes.Status202Accepted => Results.Accepted(
            $"/api/v1/classes/{classId}/bookings/{outcome.Booking!.BookingId}",
            payload),
        _ => Results.Ok(payload),
    };
});

v1.MapDelete("/classes/{classId}/bookings/{bookingId}", async (
    string classId,
    string bookingId,
    IClassBookingEngine engine,
    CancellationToken ct) =>
{
    var outcome = await engine.CancelAsync(classId, bookingId, ct).ConfigureAwait(false);
    if (outcome.ErrorCode is not null)
    {
        return Results.Problem(
            title: outcome.ErrorCode,
            detail: outcome.ErrorDetail,
            statusCode: outcome.StatusCode);
    }

    return Results.Ok(new
    {
        cancelledBookingId = outcome.CancelledBookingId,
        classId = outcome.ClassId,
        previousStatus = outcome.PreviousStatus,
        promotedBooking = outcome.PromotedBooking,
        updatedWaitlist = outcome.UpdatedWaitlist,
        classSnapshot = outcome.ClassSnapshot,
    });
});

app.Run();

public partial class Program;
