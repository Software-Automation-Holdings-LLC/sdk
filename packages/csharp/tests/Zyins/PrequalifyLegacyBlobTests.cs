// Tests for the LegacyBlobAsync variant of PrequalifySubClient. Exercises
// the wire-passthrough contract — the SDK serializes the encoded payload
// dictionary verbatim and forwards it to /v1/prequalify.
using System.Text.Json;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class PrequalifyLegacyBlobTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    [Fact]
    public async Task LegacyBlobAsync_ForwardsBodyVerbatim()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"plans":[],"request_id":"req_01HZK2N5GQR9T8X4B6FJW3Y1AS"}""");
        });
        var payload = new Dictionary<string, object?>
        {
            ["enc"] = "AAAAA",
            ["v"] = 2,
        };
        var client = ClientWith(transport);

        var result = await client.Prequalify.LegacyBlobAsync(payload);

        Assert.NotNull(result);
        Assert.NotNull(captured);
        Assert.Equal("/v1/prequalify", captured!.Url.AbsolutePath);
        Assert.NotNull(captured.Body);
        using var doc = JsonDocument.Parse(captured.Body!);
        Assert.Equal("AAAAA", doc.RootElement.GetProperty("enc").GetString());
        Assert.Equal(2, doc.RootElement.GetProperty("v").GetInt32());
    }

    [Fact]
    public async Task LegacyBlobAsync_RejectsNullPayload()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            throw new InvalidOperationException("transport must not be reached")));
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            client.Prequalify.LegacyBlobAsync(null!));
    }
}
