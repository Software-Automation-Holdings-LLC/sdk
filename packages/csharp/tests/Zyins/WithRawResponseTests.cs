// Tests for the WithRawResponseAsync variants — exposes the raw
// HTTP response alongside the parsed body (Stainless / Stripe pattern).
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class WithRawResponseTests
{
    [Fact]
    public async Task Prequalify_WithRawResponseAsync_ReturnsStatusHeadersAndUri()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string>
            {
                ["X-Request-Id"] = Fixtures.SampleRequestId,
                ["X-Isa-Idempotency-Key"] = "550e8400-e29b-41d4-a716-446655440000",
            },
            Body: """{"plans":[],"request_id":"req_x"}"""));
        var client = new ZyInsClient(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

        var (data, raw) = await client.Prequalify.WithRawResponseAsync(Fixtures.JohnDoePrequalifyInput());

        Assert.Empty(data.Plans);
        Assert.Equal(200, raw.StatusCode);
        Assert.EndsWith("/v1/prequalify", raw.RequestUri.AbsolutePath);
        Assert.True(raw.Headers.ContainsKey("X-Request-Id"));
        Assert.True(raw.Headers.ContainsKey("X-Isa-Idempotency-Key"));
        Assert.Contains("plans", raw.Body);
    }

    [Fact]
    public async Task Quote_WithRawResponseAsync_ReturnsStatusHeadersAndUri()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string> { ["X-Request-Id"] = Fixtures.SampleRequestId },
            Body: """{"plans":[],"request_id":"req_q"}"""));
        var client = new ZyInsClient(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

        var (data, raw) = await client.Quote.WithRawResponseAsync(new QuoteInput
        {
            Applicant = Fixtures.JohnDoe(),
            Coverage = Coverage.ByFaceValue(50_000),
        });

        Assert.Empty(data.Plans);
        Assert.Equal(200, raw.StatusCode);
        Assert.EndsWith("/v1/quote", raw.RequestUri.AbsolutePath);
    }

    [Fact]
    public void Envelope_RecordExposesAllFields()
    {
        var env = new Envelope<int>(
            Data: 42,
            RequestId: "req_x",
            IdempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
            RetryAttempts: 2,
            Livemode: true);
        Assert.Equal(42, env.Data);
        Assert.Equal("req_x", env.RequestId);
        Assert.Equal("550e8400-e29b-41d4-a716-446655440000", env.IdempotencyKey);
        Assert.Equal(2, env.RetryAttempts);
        Assert.True(env.Livemode);
    }
}
