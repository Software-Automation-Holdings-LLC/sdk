// Tests for the license-mode ergonomic factories (Isa.WithLicense / Isa.FromEnv),
// zero-arg license ops, license-key auto-stash, and the OnLicenseRefreshed event.
using Sah.Sdk;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class LicensesErgonomicsTests
{
    private sealed class FakeEnv : IEnvironment
    {
        private readonly Dictionary<string, string> _vars;
        public FakeEnv(Dictionary<string, string> vars) => _vars = vars;
        public string? Get(string name) => _vars.TryGetValue(name, out var v) ? v : null;
    }

    [Fact]
    public void WithLicense_KeycodeEmail_BuildsLicenseModeClient()
    {
        var isa = Isa.WithLicense("ABC-123-XYZ", "john.doe@acme-agency.com");
        Assert.NotNull(isa);
        Assert.NotNull(isa.Zyins);
        Assert.NotNull(isa.Zyins.Licenses);
    }

    [Fact]
    public void FromEnv_ReadsLicenseEnvVars()
    {
        var env = new FakeEnv(new Dictionary<string, string>
        {
            ["ISA_LICENSE_KEYCODE"] = "ABC-123-XYZ",
            ["ISA_LICENSE_EMAIL"] = "john.doe@acme-agency.com",
        });
        var isa = Isa.FromEnv(env);
        Assert.NotNull(isa);
    }

    [Fact]
    public void FromEnv_ThrowsWhenEnvMissing()
    {
        var env = new FakeEnv(new Dictionary<string, string>());
        Assert.Throws<IsaConfigException>(() => Isa.FromEnv(env));
    }

    [Fact]
    public async Task ActivateAsync_ZeroArg_UsesStateAndStashesLicenseKey()
    {
        var refreshed = 0;
        LicenseRefreshedEvent? observed = null;
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"active","auth":{"license_key":"LK-NEW"},"remaining_activations":4}"""));
        // Build the client manually through ZyinsFactory so we can inject the FakeTransport.
        // The public Isa factories don't accept transports, but we exercise the same code
        // path by accessing Zyins.Licenses directly after grafting in a stub transport.
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "x@y.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var store = new InMemoryCredentialStore();
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store);
        client.CredentialState!.OnLicenseRefreshed(e =>
        {
            refreshed++;
            observed = e;
        });

        var result = await client.Licenses.ActivateAsync();

        Assert.Equal("active", result.Status);
        Assert.Equal("LK-NEW", result.Auth.LicenseKey);
        Assert.Equal(1, refreshed);
        Assert.NotNull(observed);
        Assert.Equal("LK-NEW", observed!.LicenseKey);
        Assert.Equal("LK-NEW", client.CredentialState.LicenseKey);
        var stashed = await store.GetAsync(CredentialKeys.LicenseKey);
        Assert.Equal("LK-NEW", stashed);
    }

    [Fact]
    public async Task DeactivateAsync_ZeroArg_ClearsStashedKey()
    {
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"deactivated"}"""));
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "x@y.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var store = new InMemoryCredentialStore();
        await store.SetAsync(CredentialKeys.LicenseKey, "LK-OLD");
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store);
        await client.CredentialState!.RefreshLicenseKeyAsync("LK-OLD");

        var result = await client.Licenses.DeactivateAsync();

        Assert.Equal("deactivated", result.Status);
        Assert.Equal(string.Empty, client.CredentialState.LicenseKey);
        var stashed = await store.GetAsync(CredentialKeys.LicenseKey);
        Assert.Null(stashed);
    }

    [Fact]
    public async Task WithLicense_RestoresStashedLicenseKey()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"valid"}""");
        });
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "x@y.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var store = new InMemoryCredentialStore();
        await store.SetAsync(CredentialKeys.LicenseKey, "LK-OLD");
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store);

        await client.Licenses.CheckAsync();

        Assert.Equal("LK-OLD", client.CredentialState!.LicenseKey);
        Assert.NotNull(captured);
        Assert.Contains("LK-OLD", captured!.Body!);
    }

    [Fact]
    public async Task DeactivateAsync_UnexpectedStatus_KeepsStashedKey()
    {
        var transport = new FakeTransport((_, _) =>
            new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"already_deactivated"}"""));
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "x@y.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var store = new InMemoryCredentialStore();
        await store.SetAsync(CredentialKeys.LicenseKey, "LK-OLD");
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store);
        await client.CredentialState!.RefreshLicenseKeyAsync("LK-OLD");

        await Assert.ThrowsAsync<InvalidOperationException>(() => client.Licenses.DeactivateAsync());

        Assert.Equal("LK-OLD", client.CredentialState.LicenseKey);
        var stashed = await store.GetAsync(CredentialKeys.LicenseKey);
        Assert.Equal("LK-OLD", stashed);
    }

    [Fact]
    public async Task CheckAsync_ZeroArg_FillsFromState()
    {
        TransportRequest? captured = null;
        var transport = new FakeTransport((req, _) =>
        {
            captured = req;
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string>(),
                Body: """{"status":"valid"}""");
        });
        var creds = new LicenseCredentials { Keycode = "ABC-123-XYZ", Email = "x@y.com" };
        var opts = new ZyInsClientOptions { Transport = transport };
        var env = new FakeEnv(new Dictionary<string, string>());
        var client = ZyinsFactory.WithLicense(creds, opts, env, store: null);

        var result = await client.Licenses.CheckAsync();

        Assert.Equal("valid", result.Status);
        Assert.NotNull(captured);
        Assert.NotNull(captured!.Body);
        Assert.Contains("ABC-123-XYZ", captured.Body!);
        Assert.Contains("x@y.com", captured.Body!);
    }

    [Fact]
    public async Task ActivateAsync_ZeroArg_ThrowsWhenNonLicenseMode()
    {
        var transport = new FakeTransport((_, _) =>
            throw new InvalidOperationException("transport must not be reached"));
        var client = new ZyInsClient(new ZyInsClientOptions
        {
            Token = Fixtures.SampleToken,
            Transport = transport,
        });
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.Licenses.ActivateAsync());
    }
}
