// Tests for the fluent ZyInsClient.Configure builder and the base URL
// override path.
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class BuilderAndOptionsTests
{
    [Fact]
    public async Task ConfigureBuilder_RoundTripsBaseUrlAndTransport()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"plans":[],"request_id":"r"}""");
        });

        var client = ZyInsClient.Configure(Fixtures.SampleToken)
            .WithBaseUrl("https://zyins-staging.isaapi.com")
            .WithTimeout(TimeSpan.FromSeconds(5))
            .WithTransport(transport)
            .Build();

        await client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput());

        Assert.NotNull(captured);
        Assert.Equal("zyins-staging.isaapi.com", captured!.Url.Host);
    }

    [Fact]
    public void DefaultBaseUrl_IsProduction()
    {
        Assert.Equal("https://zyins.isaapi.com", ZyInsClient.DefaultBaseUrl);
    }

    [Fact]
    public void FixedClock_Honors_Set()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 17, 0, 0, 0, TimeSpan.Zero));
        Assert.Equal(2026, clock.UtcNow().Year);
        clock.Set(new DateTimeOffset(2027, 1, 1, 0, 0, 0, TimeSpan.Zero));
        Assert.Equal(2027, clock.UtcNow().Year);
    }
}
