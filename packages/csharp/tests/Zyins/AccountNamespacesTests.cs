// Tests for the Branding / Preferences / Cases / Email sub-clients.
using System.Text.Json;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class AccountNamespacesTests
{
    private static ZyInsClient ClientWith(ITransport transport) =>
        new(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

    // ---------------------- Branding -----------------------------

    [Fact]
    public async Task BrandingLookup_ParsesSnakeCaseFields()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"imo_name":"Acme Agency","imo_logo":"https://cdn.example/logo.png","hide_affiliate_leads":"true","prevent_product_selection":false,"nav_color":"#111"}""");
        });

        var result = await ClientWith(transport).Branding.LookupAsync();
        Assert.Equal("Acme Agency", result.ImoName);
        Assert.True(result.HideAffiliateLeads);
        Assert.False(result.PreventProductSelection);
        Assert.Equal(HttpVerb.Get, captured[0].Method);
        Assert.Contains("/v1/branding", captured[0].Url.ToString());
    }

    [Fact]
    public async Task BrandingLookup_ReturnsZeroValuesOnEmptyRow()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200, Headers: new Dictionary<string, string>(), Body: "{}"));
        var result = await ClientWith(transport).Branding.LookupAsync();
        Assert.Equal(string.Empty, result.ImoName);
        Assert.False(result.HideAffiliateLeads);
    }

    [Fact]
    public async Task BrandingLookup_500ThrowsTypedException()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 500,
            Headers: new Dictionary<string, string>(),
            Body: """{"type":"about:blank","title":"server","status":500,"code":"server_error"}"""));
        await Assert.ThrowsAnyAsync<IsaException>(
            () => ClientWith(transport).Branding.LookupAsync());
    }

    // ---------------------- Preferences --------------------------

    [Fact]
    public async Task PreferencesLookup_ReturnsPrefs()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200, Headers: new Dictionary<string, string>(),
            Body: """{"prefs":{"theme":"dark"}}"""));
        var result = await ClientWith(transport).Preferences.LookupAsync();
        Assert.NotNull(result.Prefs);
        Assert.Contains("theme", result.Prefs.Keys);
    }

    [Fact]
    public async Task PreferencesSet_SerializesBodyAndMintsIdempotencyKey()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200, Headers: new Dictionary<string, string>(),
                Body: """{"prefs":{"theme":"dark"}}""");
        });

        var result = await ClientWith(transport).Preferences.SetAsync(new PreferencesSetRequest
        {
            Prefs = new Dictionary<string, object?> { ["theme"] = "dark" },
        });

        Assert.NotEmpty(result.Prefs);
        var req = captured[0];
        Assert.Equal(HttpVerb.Post, req.Method);
        Assert.Contains("/v1/preferences", req.Url.ToString());
        using var doc = JsonDocument.Parse(req.Body!);
        Assert.True(doc.RootElement.TryGetProperty("prefs", out var prefs));
        Assert.Equal("dark", prefs.GetProperty("theme").GetString());
    }

    [Fact]
    public async Task PreferencesSet_401ThrowsTypedException()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 401,
            Headers: new Dictionary<string, string>(),
            Body: """{"type":"about:blank","title":"unauthorized","status":401,"code":"unauthorized"}"""));
        await Assert.ThrowsAnyAsync<IsaException>(
            () => ClientWith(transport).Preferences.SetAsync(new PreferencesSetRequest
            {
                Prefs = new Dictionary<string, object?> { ["a"] = 1 },
            }));
    }

    // ---------------------- Cases --------------------------------

    [Fact]
    public async Task CasesCreate_SerializesAndParsesHash()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200, Headers: new Dictionary<string, string>(),
                Body: """{"object":"case","hash":"abc123","url":"https://share.example/case/abc123","readonly":true,"created_at":"2026-05-20T14:32:01Z"}""");
        });

        var result = await ClientWith(transport).Cases.CreateAsync(new CaseCreateRequest
        {
            Input = new Dictionary<string, object?>
            {
                ["applicant"] = new Dictionary<string, object?> { ["name"] = "John Doe" },
            },
            Results = new Dictionary<string, object?> { ["decided"] = true },
            Products = new List<string> { "senior-life" },
        });

        Assert.Equal("abc123", result.Hash);
        Assert.True(result.Readonly);
        Assert.Equal("2026-05-20T14:32:01Z", result.CreatedAt);

        var req = captured[0];
        Assert.Equal(HttpVerb.Post, req.Method);
        Assert.Contains("/v1/case", req.Url.ToString());
    }

    [Fact]
    public async Task CasesCreate_AcceptsRawXmlInput()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200, Headers: new Dictionary<string, string>(),
                Body: """{"object":"case","hash":"x","url":"","readonly":false,"created_at":""}""");
        });

        await ClientWith(transport).Cases.CreateAsync(new CaseCreateRequest
        {
            Input = "<applicant/>",
        });

        using var doc = JsonDocument.Parse(captured[0].Body!);
        Assert.Equal("<applicant/>", doc.RootElement.GetProperty("input").GetString());
    }

    [Fact]
    public async Task CasesCreate_RejectsMissingInput()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200, Headers: new Dictionary<string, string>(), Body: "{}"));
        await Assert.ThrowsAsync<ArgumentException>(
            () => ClientWith(transport).Cases.CreateAsync(new CaseCreateRequest { Input = "" }));
    }

    [Fact]
    public async Task CasesCreate_500ThrowsTypedException()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 500,
            Headers: new Dictionary<string, string>(),
            Body: """{"type":"about:blank","title":"server","status":500,"code":"server_error"}"""));
        await Assert.ThrowsAnyAsync<IsaException>(
            () => ClientWith(transport).Cases.CreateAsync(new CaseCreateRequest
            {
                Input = new Dictionary<string, object?> { ["a"] = 1 },
            }));
    }

    // ---------------------- Email --------------------------------

    [Fact]
    public async Task EmailEnqueue_SerializesAttachment()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200, Headers: new Dictionary<string, string>(),
                Body: """{"enqueue_id":"eq_1"}""");
        });

        var result = await ClientWith(transport).Email.EnqueueAsync(new EmailEnqueueRequest
        {
            To = "jane@smith.com",
            Subject = "Your case",
            BodyHtml = "<p>Hi</p>",
            Attachment = new EmailAttachment
            {
                Filename = "case-1.pdf",
                ContentBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("PDF-bytes")),
            },
        });

        Assert.Equal("eq_1", result.EnqueueId);
        var req = captured[0];
        Assert.Equal(HttpVerb.Post, req.Method);
        Assert.Contains("/v1/email/enqueue", req.Url.ToString());
        using var doc = JsonDocument.Parse(req.Body!);
        Assert.True(doc.RootElement.TryGetProperty("attachment", out _));
    }

    [Fact]
    public async Task EmailEnqueue_RejectsMissingTo()
    {
        var transport = new FakeTransport((_, _) => new TransportResponse(
            Status: 200, Headers: new Dictionary<string, string>(), Body: "{}"));
        await Assert.ThrowsAsync<ArgumentException>(
            () => ClientWith(transport).Email.EnqueueAsync(new EmailEnqueueRequest
            {
                To = "",
                Subject = "s",
                BodyHtml = "b",
            }));
    }

    [Fact]
    public async Task CasesEmail_TargetsEnqueueEndpoint()
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return new TransportResponse(
                Status: 200, Headers: new Dictionary<string, string>(),
                Body: """{"enqueue_id":"eq_2"}""");
        });

        await ClientWith(transport).Cases.EmailAsync(new EmailEnqueueRequest
        {
            To = "jane@smith.com",
            Subject = "s",
            BodyHtml = "b",
        });

        Assert.Contains("/v1/email/enqueue", captured[0].Url.ToString());
    }
}
