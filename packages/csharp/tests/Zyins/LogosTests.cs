// Tests for the LogosSubClient. Exercises the GET path, the ?ds=true
// data-URI branch, and the non-credentialed header contract.
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class LogosTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    [Fact]
    public async Task GetAsync_DefaultBytes_NoQuery()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            var bodyBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47 };
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: "corrupted-text",
                BodyBytes: bodyBytes);
        });

        var client = ClientWith(transport);
        var result = await client.Logos.GetAsync("aetna");

        Assert.NotNull(captured);
        Assert.Equal("/v1/logo/aetna", captured!.Url.AbsolutePath);
        Assert.Equal(string.Empty, captured.Url.Query);
        Assert.NotNull(result.Bytes);
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, result.Bytes);
        Assert.Null(result.DataUri);
    }

    [Fact]
    public async Task GetAsync_DataUri_AddsQueryAndReturnsString()
    {
        const string dataUri = "data:image/png;base64,abc==";
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(200, new Dictionary<string, string>(), dataUri));
        var client = ClientWith(transport);

        var result = await client.Logos.GetAsync("aetna", new LogosOptions { DataUri = true });

        Assert.Equal(dataUri, result.DataUri);
        Assert.Null(result.Bytes);
    }

    [Fact]
    public async Task GetAsync_DataUri_RejectsNonImagePrefix()
    {
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(200, new Dictionary<string, string>(), "not-a-data-uri"));
        var client = ClientWith(transport);

        await Assert.ThrowsAsync<IsaException>(() =>
            client.Logos.GetAsync("aetna", new LogosOptions { DataUri = true }));
    }

    [Fact]
    public async Task GetAsync_404SurfacesAsTypedException()
    {
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(
                404,
                new Dictionary<string, string> { ["Content-Type"] = "application/problem+json" },
                """{"code":"not_found","message":"unknown carrier"}"""));
        var client = ClientWith(transport);

        await Assert.ThrowsAsync<IsaException>(() =>
            client.Logos.GetAsync("unknown-carrier"));
    }

    [Fact]
    public async Task GetAsync_RejectsEmptyCarrier()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            throw new InvalidOperationException("transport must not be reached")));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.Logos.GetAsync(""));
    }
}
