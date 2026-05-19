// Tests for the typed IsaIdempotencyConflictException and its
// parsing from ProblemDetails on 409 responses.
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class IdempotencyConflictTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    [Fact]
    public async Task Conflict_RaisesTypedException_WithKeyAndFirstSeenAt()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 409,
            Headers: new Dictionary<string, string>(),
            Body: """
            {
              "code": "idempotency_conflict",
              "detail": "Key reused with different body",
              "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
              "first_seen_at": "2026-05-14T14:32:01Z"
            }
            """)));

        var ex = await Assert.ThrowsAsync<IsaIdempotencyConflictException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));

        Assert.Equal("idempotency_conflict", ex.Code);
        Assert.Equal(ErrorCode.IdempotencyConflict, ex.CodeEnum);
        Assert.Equal(409, ex.HttpStatus);
        Assert.Equal("550e8400-e29b-41d4-a716-446655440000", ex.Key);
        Assert.Equal(new DateTimeOffset(2026, 5, 14, 14, 32, 1, TimeSpan.Zero), ex.FirstSeenAt);
    }

    [Fact]
    public async Task Conflict_FallsBackToHeader_WhenBodyOmitsKey()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 409,
            Headers: new Dictionary<string, string> { ["X-Isa-Idempotency-Key"] = "header-key-1" },
            Body: """{"code":"idempotency_conflict","detail":"conflict"}""")));

        var ex = await Assert.ThrowsAsync<IsaIdempotencyConflictException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));

        Assert.Equal("header-key-1", ex.Key);
        Assert.Null(ex.FirstSeenAt);
    }

    [Fact]
    public async Task NonIdempotency_409_RaisesPlainException()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 409,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"conflict","detail":"generic conflict"}""")));

        var ex = await Assert.ThrowsAsync<IsaException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));
        Assert.IsNotType<IsaIdempotencyConflictException>(ex);
    }
}
