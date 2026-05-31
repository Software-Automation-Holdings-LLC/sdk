// <c>Isa.Builder</c> — fluent constructor for the unified
// <see cref="Isa"/> facade. Mirrors the locked TS API
// (<c>await Isa.withKeycode({ keycode, email, autocorrector?, matchAlgorithm?, autocompleteAlgorithm? })</c>).
//
// The builder is the only documented entry point for injecting custom
// <see cref="Isa.Sdk.Zyins.Reference.IAutocorrector"/> /
// <see cref="Isa.Sdk.Zyins.Reference.IMatchAlgorithm"/> /
// <see cref="Isa.Sdk.Zyins.Reference.IAutocompleteAlgorithm"/> adapters.
// Omitting an adapter falls back to the corresponding <c>Default*</c>
// implementation. The credential factories (<see cref="Isa.WithKeycode(string, string)"/>,
// <see cref="Isa.WithBearer(string)"/>, etc.) remain the convenient
// path when defaults are sufficient.
using System;
using System.Threading.Tasks;
using Isa.Sdk.Core;
using Isa.Sdk.Zyins;
using Isa.Sdk.Zyins.Reference;

namespace Isa.Sdk;

public sealed partial class Isa
{
    /// <summary>Begin a fluent <see cref="Isa"/> construction. Pick a
    /// credential mode via <see cref="IsaBuilder.WithKeycode(string, string)"/>
    /// / <see cref="IsaBuilder.WithBearer(string)"/> /
    /// <see cref="IsaBuilder.WithSession(string, string)"/>, then layer
    /// adapter overrides via <see cref="IsaBuilder.WithAutocorrector(IAutocorrector)"/>
    /// etc., then <see cref="IsaBuilder.Build"/>.</summary>
    public static IsaBuilder Builder() => new();
}

/// <summary>Fluent constructor for <see cref="Isa"/>. Adapter overrides
/// are wholesale-replacement: the supplied instance is used verbatim
/// (no chaining, no decoration). To compose, wrap the previous adapter
/// in your custom impl before calling <c>With*</c>.</summary>
/// <example>
/// <code>
/// var isa = Isa.Builder()
///     .WithKeycode("ABC-123-XYZ", "agent@example.com")
///     .WithAutocorrector(myCustomAutocorrector)
///     .Build();
/// </code>
/// </example>
public sealed class IsaBuilder
{
    private string? _bearerToken;
    private string? _keycode;
    private string? _email;
    private string? _sessionId;
    private string? _sessionSecret;
    private string? _formToken;
    private IAutocorrector? _autocorrector;
    private IMatchAlgorithm? _matchAlgorithm;
    private IAutocompleteAlgorithm? _autocompleteAlgorithm;
    private IEnvironment _env = SystemEnvironment.Instance;

    internal IsaBuilder() { }

    /// <summary>Construct as a license-mode (keycode+email) client.</summary>
    public IsaBuilder WithKeycode(string keycode, string email)
    {
        _keycode = keycode;
        _email = email;
        return this;
    }

    /// <summary>Construct as a bearer-token client.</summary>
    public IsaBuilder WithBearer(string token)
    {
        _bearerToken = token;
        return this;
    }

    /// <summary>Construct as a session-mode client.</summary>
    public IsaBuilder WithSession(string sessionId, string sessionSecret)
    {
        _sessionId = sessionId;
        _sessionSecret = sessionSecret;
        return this;
    }

    /// <summary>Construct as an embedded-form client.</summary>
    public IsaBuilder ForForm(string formToken)
    {
        _formToken = formToken;
        return this;
    }

    /// <summary>Inject a custom <see cref="IAutocorrector"/>; omit to
    /// use <see cref="DefaultAutocorrector"/> bound to the zyins
    /// <c>spelling_corrections</c> dataset (resolved lazily on first
    /// <c>Autocorrector.Correct</c> call).</summary>
    public IsaBuilder WithAutocorrector(IAutocorrector autocorrector)
    {
        _autocorrector = autocorrector ?? throw new ArgumentNullException(nameof(autocorrector));
        return this;
    }

    /// <summary>Inject a custom <see cref="IMatchAlgorithm"/>; omit to
    /// use <see cref="DefaultMatchAlgorithm"/>.</summary>
    public IsaBuilder WithMatchAlgorithm(IMatchAlgorithm matchAlgorithm)
    {
        _matchAlgorithm = matchAlgorithm ?? throw new ArgumentNullException(nameof(matchAlgorithm));
        return this;
    }

    /// <summary>Inject a custom <see cref="IAutocompleteAlgorithm"/>;
    /// omit to use <see cref="DefaultAutocompleteAlgorithm"/>.</summary>
    public IsaBuilder WithAutocompleteAlgorithm(IAutocompleteAlgorithm autocompleteAlgorithm)
    {
        _autocompleteAlgorithm = autocompleteAlgorithm
            ?? throw new ArgumentNullException(nameof(autocompleteAlgorithm));
        return this;
    }

    /// <summary>Override the environment lookup (test seam).</summary>
    public IsaBuilder WithEnvironment(IEnvironment env)
    {
        _env = env ?? throw new ArgumentNullException(nameof(env));
        return this;
    }

    /// <summary>Build the <see cref="Isa"/> instance. Picks the
    /// credential mode by which <c>With*</c> setter was last called;
    /// resolution order: bearer, keycode+email, session, form.</summary>
    public Isa Build()
    {
        var isa = ResolveCredentialMode();
        isa.Zyins.AttachAdapters(_autocorrector, _matchAlgorithm, _autocompleteAlgorithm);
        return isa;
    }

    private Isa ResolveCredentialMode()
    {
        if (!string.IsNullOrWhiteSpace(_bearerToken)) return Isa.WithBearer(_bearerToken, _env);
        if (!string.IsNullOrWhiteSpace(_keycode) && !string.IsNullOrWhiteSpace(_email))
            return Isa.WithLicense(_keycode!, _email!, _env);
        if (!string.IsNullOrWhiteSpace(_sessionId) && !string.IsNullOrWhiteSpace(_sessionSecret))
            return Isa.WithSession(
                new SessionOptions { SessionId = _sessionId!, SessionSecret = _sessionSecret! },
                _env);
        if (!string.IsNullOrWhiteSpace(_formToken))
            return Isa.ForForm(new FormOptions { FormToken = _formToken! }, _env);
        throw new ArgumentException(
            "Isa.Builder.Build: no credential mode supplied. Call one of WithKeycode/WithBearer/WithSession/ForForm before Build.");
    }
}
