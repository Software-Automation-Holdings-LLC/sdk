// Tests for the prequalify happy path and error mapping.
using System.Text.Json;
using Sah.Sdk.Core;
using Moq;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class PrequalifyTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    [Fact]
    public async Task RunAsync_HappyPath_PostsBearerHeaderAndParsesBody()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string> { ["X-Request-Id"] = Fixtures.SampleRequestId },
                Body: """
                {
                    "plans": [
                        {"brand": "colonial-penn", "tier": "preferred-plus", "monthly_premium": 42.50, "face_value": 50000, "product_token": "cp-senior-life-pp"}
                    ],
                    "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
                }
                """);
        });

        var client = ClientWith(transport);
        var result = await client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput());

        Assert.Single(result.Plans);
        Assert.Equal("colonial-penn", result.Plans[0].Brand);
        Assert.Equal("preferred-plus", result.Plans[0].Tier);
        Assert.Equal(42.50, result.Plans[0].MonthlyPremium);
        Assert.Equal(50_000, result.Plans[0].FaceValue);
        Assert.Equal(Fixtures.SampleRequestId, result.RequestId);

        Assert.Single(captured);
        var req = captured[0];
        Assert.Equal(HttpVerb.Post, req.Method);
        Assert.EndsWith("/v1/prequalify", req.Url.AbsolutePath);
        Assert.True(req.Headers.TryGetValue("Authorization", out var auth));
        Assert.Equal($"Bearer {Fixtures.SampleToken}", auth);
        Assert.NotNull(req.Body);
        using var doc = JsonDocument.Parse(req.Body!);
        var root = doc.RootElement;
        Assert.Equal("1962-04-18", root.GetProperty("applicant").GetProperty("dob").GetString());
        Assert.Equal("M", root.GetProperty("applicant").GetProperty("sex").GetString());
        Assert.Equal("none", root.GetProperty("applicant").GetProperty("nicotine_use").GetString());
    }

    [Fact]
    public async Task RunAsync_401_RaisesIsaAuthException()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 401,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"unauthorized","title":"Bad token"}""")));

        var ex = await Assert.ThrowsAsync<IsaAuthException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));
        Assert.Equal("unauthorized", ex.Code);
        Assert.Equal(401, ex.HttpStatus);
    }

    [Fact]
    public async Task RunAsync_403_LicenseCode_RaisesIsaLicenseException()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 403,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"license_expired","detail":"Your license expired on 2026-04-01"}""")));

        var ex = await Assert.ThrowsAsync<IsaLicenseException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));
        Assert.Equal("license_expired", ex.Code);
        Assert.Contains("expired", ex.Message);
    }

    [Fact]
    public async Task RunAsync_400_RaisesIsaValidationException_WithParam()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 400,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"validation_error","detail":"dob malformed","param":"/applicant/dob"}""")));

        var ex = await Assert.ThrowsAsync<IsaValidationException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));
        Assert.Equal("validation_error", ex.Code);
        Assert.Equal("/applicant/dob", ex.Param);
    }

    [Fact]
    public async Task RunAsync_429_RaisesRateLimitWithRetryAfter()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 429,
            Headers: new Dictionary<string, string> { ["Retry-After"] = "12" },
            Body: """{"code":"rate_limited","detail":"slow down"}""")));

        var ex = await Assert.ThrowsAsync<IsaRateLimitException>(() =>
            client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()));
        Assert.Equal(TimeSpan.FromSeconds(12), ex.RetryAfter);
    }

    [Fact]
    public async Task RunAsync_MoqTransport_AlsoWorks()
    {
        var mock = new Mock<ITransport>();
        mock.Setup(t => t.SendAsync(It.IsAny<TransportRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"plans":[],"request_id":"req_x"}"""));

        var client = ClientWith(mock.Object);
        var result = await client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput());
        Assert.Empty(result.Plans);
        Assert.Equal("req_x", result.RequestId);
        mock.Verify(t => t.SendAsync(It.IsAny<TransportRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Constructor_RequiresToken()
    {
        Assert.Throws<ArgumentException>(() => new ZyInsClient(""));
        Assert.Throws<ArgumentException>(() => new ZyInsClient("   "));
    }
}
