// Tests for the Licenses + Health sub-clients.
using System.Text.Json;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class LicensesAndHealthTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    // --- Licenses.CheckAsync ----------------------------------------------

    [Fact]
    public async Task CheckAsync_HappyPath_PostsJsonAndParsesStatus()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"valid"}""");
        });

        var client = ClientWith(transport);
        var result = await client.Licenses.CheckAsync(new LicensesCheckRequest
        {
            Email = "john.doe@acme-agency.com",
            Keycode = "ABC-123-XYZ",
            DeviceId = "device-1",
        });

        Assert.Equal("valid", result.Status);
        Assert.Equal(LicenseValidationStatus.Valid, result.ValidationStatus);

        var req = captured[0];
        Assert.Equal(HttpVerb.Post, req.Method);
        Assert.EndsWith("/v1/licenses/check", req.Url.AbsolutePath);
        Assert.NotNull(req.Body);
        using var doc = JsonDocument.Parse(req.Body!);
        Assert.Equal("john.doe@acme-agency.com", doc.RootElement.GetProperty("email").GetString());
        Assert.Equal("ABC-123-XYZ", doc.RootElement.GetProperty("keycode").GetString());
        Assert.Equal("device-1", doc.RootElement.GetProperty("device_id").GetString());
    }

    [Fact]
    public async Task CheckAsync_RejectsMissingEmail()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            throw new InvalidOperationException("transport must not be reached")));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.Licenses.CheckAsync(new LicensesCheckRequest { Email = "", Keycode = "ABC-123-XYZ" }));
    }

    [Fact]
    public async Task CheckAsync_AcceptsAdr012Envelope()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string>(),
            Body: """{"data":{"status":"inactive"}}""")));

        var result = await client.Licenses.CheckAsync(new LicensesCheckRequest
        {
            Email = "x@x",
            Keycode = "ABC-123-XYZ",
        });

        Assert.Equal("inactive", result.Status);
    }

    [Fact]
    public async Task CheckAsync_RejectsNullAdr012Envelope()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string>(),
            Body: """{"data":null}""")));

        await Assert.ThrowsAsync<JsonException>(() =>
            client.Licenses.CheckAsync(new LicensesCheckRequest { Email = "x@x", Keycode = "ABC-123-XYZ" }));
    }

    [Fact]
    public async Task CheckAsync_RejectsMissingKeycode()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            throw new InvalidOperationException("transport must not be reached")));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.Licenses.CheckAsync(new LicensesCheckRequest { Email = "x@x", Keycode = "" }));
    }

    [Fact]
    public async Task CheckAsync_ServerErrorPropagates()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 500,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"server_error","detail":"boom"}""")));

        await Assert.ThrowsAsync<IsaException>(() =>
            client.Licenses.CheckAsync(new LicensesCheckRequest { Email = "x@x", Keycode = "ABC-123-XYZ" }));
    }

    // --- Licenses.DeactivateAsync ----------------------------------------

    [Fact]
    public async Task DeactivateAsync_HappyPath_PostsJsonAndParsesStatus()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"deactivated"}""");
        });

        var client = ClientWith(transport);
        var result = await client.Licenses.DeactivateAsync(new LicensesDeactivateRequest
        {
            Email = "john.doe@acme-agency.com",
            Keycode = "ABC-123-XYZ",
        });

        Assert.Equal("deactivated", result.Status);
        Assert.EndsWith("/v1/licenses/deactivate", captured[0].Url.AbsolutePath);
    }

    [Fact]
    public async Task DeactivateAsync_AcceptsAdr012Envelope()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string>(),
            Body: """{"data":{"status":"deactivated"}}""")));

        var result = await client.Licenses.DeactivateAsync(new LicensesDeactivateRequest
        {
            Email = "john.doe@acme-agency.com",
            Keycode = "ABC-123-XYZ",
        });

        Assert.Equal("deactivated", result.Status);
    }

    // --- Health.GetReadinessAsync ----------------------------------------

    [Fact]
    public async Task GetReadinessAsync_HappyPath_ParsesTypedBody()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """
                {
                    "ready": true,
                    "status": "serving",
                    "db": {"status":"serving","latency_ms":3,"checked_at":"2026-05-14T14:32:01Z"},
                    "cache": {"status":"serving","latency_ms":1,"checked_at":"2026-05-14T14:32:01Z"},
                    "checked_at": "2026-05-14T14:32:01Z"
                }
                """);
        });

        var client = ClientWith(transport);
        var result = await client.Health.GetReadinessAsync();

        Assert.True(result.Ready);
        Assert.Equal("serving", result.Status);
        Assert.Equal(3, result.Db.LatencyMs);
        Assert.Equal(ServingStatus.Serving, result.Db.ServingStatus);
        Assert.Equal(HttpVerb.Get, captured[0].Method);
        Assert.EndsWith("/ready", captured[0].Url.AbsolutePath);
    }

    [Fact]
    public async Task GetReadinessAsync_ParsesDownstreamMap()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200,
            Headers: new Dictionary<string, string>(),
            Body: """
            {
                "ready": false,
                "status": "not_serving",
                "db": {"status":"serving","latency_ms":2,"checked_at":"2026-05-14T14:32:01Z"},
                "cache": {"status":"not_serving","latency_ms":0,"message":"connection refused","checked_at":"2026-05-14T14:32:01Z"},
                "downstream_services": {
                    "accounts": {"status":"serving","latency_ms":5,"checked_at":"2026-05-14T14:32:01Z"}
                },
                "checked_at": "2026-05-14T14:32:01Z"
            }
            """));
        var client = ClientWith(transport);
        var result = await client.Health.GetReadinessAsync();
        Assert.False(result.Ready);
        Assert.Equal("connection refused", result.Cache.Message);
        Assert.Equal(5, result.DownstreamServices["accounts"].LatencyMs);
    }

    [Fact]
    public async Task GetReadinessAsync_503_SurfacesIsaException()
    {
        var client = ClientWith(new FakeTransport((_, _) => new TransportResponse(
            Status: 503,
            Headers: new Dictionary<string, string>(),
            Body: """{"code":"service_unavailable","detail":"not ready"}""")));
        await Assert.ThrowsAsync<IsaException>(() => client.Health.GetReadinessAsync());
    }
}
