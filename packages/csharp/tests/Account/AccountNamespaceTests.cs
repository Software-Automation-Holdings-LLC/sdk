// Tests for the `isa.Account.*` namespace. Exercises the FromZyInsClient
// bridge, the routing per scope on ReferenceData, and the stub-throws-on-
// non-license-identity contract.
using Sah.Sdk;
using Sah.Sdk.Account;
using Sah.Sdk.Core;
using Sah.Sdk.Zyins;
using Sah.Sdk.Zyins.Tests;
using Xunit;

namespace Sah.Sdk.Account.Tests;

public class AccountNamespaceTests
{
    private sealed class FakeEnv : IEnvironment
    {
        private readonly Dictionary<string, string> _vars;
        public FakeEnv(Dictionary<string, string> vars) => _vars = vars;
        public string? Get(string name) => _vars.TryGetValue(name, out var v) ? v : null;
    }

    private static (AccountNamespace account, List<TransportRequest> captured) BuildLicense(
        Func<TransportRequest, TransportResponse> handler)
    {
        var captured = new List<TransportRequest>();
        var transport = new FakeTransport((req, _) =>
        {
            captured.Add(req);
            return handler(req);
        });
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "john.doe@acme-agency.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store: null);
        return (AccountNamespace.FromZyInsClient(client), captured);
    }

    [Fact]
    public async Task Branding_LookupAsync_HappyPath()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(),
                """{"imo_name":"Acme","imo_logo":"https://example.com/logo.png"}"""));
        var detail = await account.Branding.LookupAsync();
        Assert.Equal("Acme", detail.ImoName);
        Assert.Equal("/v1/branding", captured[0].Url.AbsolutePath);
    }

    [Fact]
    public async Task Preferences_LookupAsync_RequiresScope()
    {
        var (account, _) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(), """{"prefs":{}}"""));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            account.Preferences.LookupAsync(""));
    }

    [Fact]
    public async Task Preferences_LookupAsync_AddsScopeQuery()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(),
                """{"prefs":{"theme":"dark"}}"""));
        var result = await account.Preferences.LookupAsync("bpp");
        Assert.NotEmpty(result.Prefs);
        Assert.Contains("scope=bpp", captured[0].Url.Query);
    }

    [Fact]
    public async Task Cases_CreateAsync_PostsToCasesPath()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(),
                """{"hash":"abc","url":"https://example.com/c/abc","readonly":false,"created_at":"2026-05-20T00:00:00Z"}"""));
        var result = await account.Cases.CreateAsync(new CaseCreateRequest
        {
            Input = "<xml/>",
        });
        Assert.Equal("abc", result.Hash);
        Assert.Equal("/v1/case", captured[0].Url.AbsolutePath);
    }

    [Fact]
    public async Task Email_EnqueueAsync_RejectsNoRecipients()
    {
        var (account, _) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(), """{"status":"queued"}"""));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            account.Email.EnqueueAsync(new EmailEnqueueRequest
            {
                Subject = "Hello",
                Body = "World",
            }));
    }

    [Fact]
    public async Task Email_EnqueueAsync_RejectsEmptySubject()
    {
        var (account, _) = BuildLicense(_ =>
            throw new InvalidOperationException("transport must not be reached"));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            account.Email.EnqueueAsync(new EmailEnqueueRequest
            {
                To = "john.doe@example.com",
                Body = "World",
            }));
    }

    [Fact]
    public async Task Email_EnqueueAsync_SerializesFilteredRecipients()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(), """{"status":"queued"}"""));

        await account.Email.EnqueueAsync(new EmailEnqueueRequest
        {
            ToList = new[] { "", "john.doe@example.com" },
            Subject = "Hello",
            Body = "World",
        });

        Assert.NotNull(captured[0].Body);
        Assert.Contains("\"to\":[\"john.doe@example.com\"]", captured[0].Body!);
    }

    [Fact]
    public async Task ReferenceData_DatasetScope_UsesGetEndpoint()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(),
                """{"data":{"foo":"bar"}}"""));
        await account.ReferenceData.GetAsync(new ReferenceDataRequest
        {
            Scope = "dataset",
            Dataset = "carriers",
        });
        Assert.Equal("/dataset/carriers", captured[0].Url.AbsolutePath);
        Assert.Equal(HttpVerb.Get, captured[0].Method);
    }

    [Fact]
    public async Task ReferenceData_CompiledV3Scope_UsesV2PostEndpoint()
    {
        var (account, captured) = BuildLicense(_ =>
            new TransportResponse(200, new Dictionary<string, string>(), "{}"));
        await account.ReferenceData.GetAsync(new ReferenceDataRequest
        {
            Scope = "compiled_data_v3",
            Payload = new Dictionary<string, object?>
            {
                ["scope"] = "compiled_data_v2",
            },
        });
        Assert.Equal("/v2/reference-data", captured[0].Url.AbsolutePath);
        Assert.Equal(HttpVerb.Post, captured[0].Method);
        Assert.NotNull(captured[0].Body);
        Assert.Contains("\"scope\":\"compiled_data_v3\"", captured[0].Body!);
    }

    [Fact]
    public async Task FromZyInsClient_NonLicense_ReturnsStubThatThrowsAtBoundary()
    {
        // Bearer-mode client → Account namespace is a stub. First method call throws.
        var client = new ZyInsClient(new ZyInsClientOptions
        {
            Token = Fixtures.SampleToken,
            Transport = new FakeTransport((_, _) => throw new InvalidOperationException("nope")),
        });
        var ns = AccountNamespace.FromZyInsClient(client);
        Assert.NotNull(ns);
        await Assert.ThrowsAsync<IsaConfigException>(() => ns.Branding.LookupAsync());
    }
}
