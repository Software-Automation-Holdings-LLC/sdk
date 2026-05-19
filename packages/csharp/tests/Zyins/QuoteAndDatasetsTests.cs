// Tests covering Quote, Datasets, ReferenceData, and Usage sub-clients.
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class QuoteAndDatasetsTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    [Fact]
    public async Task Quote_RunAsync_PostsToV1Quote()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"plans":[],"request_id":"req_q"}""");
        });
        var client = ClientWith(transport);
        var result = await client.Quote.RunAsync(new QuoteInput
        {
            Applicant = Fixtures.JohnDoe(),
            Coverage = Coverage.ByMonthlyBudget(50),
        });
        Assert.Equal("req_q", result.RequestId);
        Assert.NotNull(captured);
        Assert.EndsWith("/v1/quote", captured!.Url.AbsolutePath);
    }

    [Fact]
    public async Task Datasets_ListAsync_GetsV1Datasets()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """[{"id":"d1","name":"D1","version":"2026-05","published_at":"2026-05-01"}]""");
        });
        var client = ClientWith(transport);
        var datasets = await client.Datasets.ListAsync();
        Assert.Single(datasets);
        Assert.Equal("d1", datasets[0].Id);
        Assert.NotNull(captured);
        Assert.Equal(HttpVerb.Get, captured!.Method);
        Assert.EndsWith("/v1/datasets", captured.Url.AbsolutePath);
    }

    [Fact]
    public async Task Datasets_GetAsync_EscapesId()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"id":"with space","name":"X","version":"v","published_at":"2026-05-01","brands":["a"]}""");
        });
        var client = ClientWith(transport);
        var ds = await client.Datasets.GetAsync("with space");
        Assert.Equal("with space", ds.Id);
        Assert.NotNull(captured);
        Assert.Contains("with%20space", captured!.Url.AbsolutePath);
    }

    [Fact]
    public async Task ReferenceData_GetAsync_BuildsKindPath()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"kind":"conditions","data":{"any":"shape"}}""");
        });
        var client = ClientWith(transport);
        var result = await client.ReferenceData.GetAsync("conditions");
        Assert.Equal("conditions", result.Kind);
        Assert.NotNull(captured);
        Assert.EndsWith("/v1/reference-data/conditions", captured!.Url.AbsolutePath);
    }

    [Fact]
    public async Task Usage_SummaryAsync_SendsPeriodQueryParam()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"period":"2026-05","prequalify_calls":100,"quote_calls":50,"total_api_calls":150}""");
        });
        var client = ClientWith(transport);
        var summary = await client.Usage.SummaryAsync("2026-05");
        Assert.Equal("2026-05", summary.Period);
        Assert.Equal(100, summary.PrequalifyCalls);
        Assert.Equal(50, summary.QuoteCalls);
        Assert.Equal(150, summary.TotalApiCalls);
        Assert.NotNull(captured);
        Assert.Contains("period=2026-05", captured!.Url.Query);
    }

    [Fact]
    public async Task Datasets_GetAsync_RejectsEmptyId()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            new TransportResponse(200, new Dictionary<string, string>(), "{}")));
        await Assert.ThrowsAsync<ArgumentException>(() => client.Datasets.GetAsync(""));
    }

    [Fact]
    public async Task Usage_SummaryAsync_RejectsEmptyPeriod()
    {
        var client = ClientWith(new FakeTransport((_, _) =>
            new TransportResponse(200, new Dictionary<string, string>(), "{}")));
        await Assert.ThrowsAsync<ArgumentException>(() => client.Usage.SummaryAsync(""));
    }
}
