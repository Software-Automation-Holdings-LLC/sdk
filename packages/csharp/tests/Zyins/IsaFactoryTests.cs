// Tests for the Sah.Sdk.Isa static factory methods and env-var defaults.
using Sah.Sdk;
using Sah.Sdk.Core;
using Sah.Sdk.Zyins;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

internal sealed class FakeEnv : IEnvironment
{
    private readonly Dictionary<string, string> _vars = new(StringComparer.Ordinal);

    public FakeEnv With(string name, string value)
    {
        _vars[name] = value;
        return this;
    }

    public string? Get(string name) => _vars.TryGetValue(name, out var v) ? v : null;
}

public class IsaFactoryTests
{
    [Fact]
    public void WithBearer_NoArgs_ReadsIsaToken()
    {
        var env = new FakeEnv().With("ISA_TOKEN", Fixtures.SampleToken);
        var isa = Sah.Sdk.Isa.WithBearer(token: null, env: env);
        Assert.NotNull(isa);
        Assert.NotNull(isa.Zyins);
    }

    [Fact]
    public void WithBearer_ExplicitArg_TakesPrecedence()
    {
        var env = new FakeEnv().With("ISA_TOKEN", Fixtures.SampleToken + "_env");
        var isa = Sah.Sdk.Isa.WithBearer(token: Fixtures.SampleToken, env: env);
        Assert.NotNull(isa);
    }

    [Fact]
    public void WithBearer_NoToken_ThrowsConfigException()
    {
        var env = new FakeEnv();
        var ex = Assert.Throws<IsaConfigException>(() =>
            Sah.Sdk.Isa.WithBearer(token: null, env: env));
        Assert.Contains("ISA_TOKEN", ex.Message);
    }

    [Fact]
    public async Task WithLicense_ReadsKeycodeAndEmail()
    {
        var env = new FakeEnv()
            .With("ISA_LICENSE_KEYCODE", "ABC-123-XYZ")
            .With("ISA_LICENSE_EMAIL", "john.doe@example.com");
        var isa = await Sah.Sdk.Isa.WithLicenseAsync(options: null, env: env);
        Assert.NotNull(isa);
    }

    [Fact]
    public async Task WithLicense_MissingEmail_ThrowsConfigException()
    {
        var env = new FakeEnv().With("ISA_LICENSE_KEYCODE", "ABC-123-XYZ");
        var ex = await Assert.ThrowsAsync<IsaConfigException>(async () =>
            await Sah.Sdk.Isa.WithLicenseAsync(options: null, env: env));
        Assert.Contains("ISA_LICENSE_EMAIL", ex.Message);
    }

    [Fact]
    public void WithSession_ReadsIdAndSecret()
    {
        var env = new FakeEnv()
            .With("ISA_SESSION_ID", "sess_01HZK2")
            .With("ISA_SESSION_SECRET", Fixtures.SampleSessionSecret);
        var isa = Sah.Sdk.Isa.WithSession(options: null, env: env);
        Assert.NotNull(isa);
    }

    [Fact]
    public void WithSession_MissingSecret_ThrowsConfigException()
    {
        var env = new FakeEnv().With("ISA_SESSION_ID", "sess_01HZK2");
        var ex = Assert.Throws<IsaConfigException>(() =>
            Sah.Sdk.Isa.WithSession(options: null, env: env));
        Assert.Contains("ISA_SESSION_SECRET", ex.Message);
    }
}
