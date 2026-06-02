// `isa.Account.*` — per-license account operations.
//
// Wraps the five account-service endpoints (branding, preferences, cases,
// email, reference-data) into a single typed surface. Mirrors the TS
// `isa.account.*` namespace.
//
// Construction is lazy: the namespace stores the underlying
// `ZyInsClient`'s operation context once and exposes one sub-facade per
// resource. Each method is a thin wrapper around an `HttpDispatcher` call
// so call sites never assemble headers.
//
// The namespace dispatches through the underlying client's shared
// `OperationContext`, so it works under every auth identity the client
// supports — bearer, license, and session alike. The context's signer
// (bearer token, license HMAC, or session HMAC) attaches the right
// `Authorization` header to each request; the Account surface never
// inspects the credential mode.
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;
using Isa.Sdk.Zyins;

namespace Isa.Sdk.Account;

/// <summary>Top-level `isa.Account.*` namespace.</summary>
public sealed class AccountNamespace
{
    /// <summary>`isa.Account.Branding` — whitelabel lookup.</summary>
    public AccountBranding Branding { get; }

    /// <summary>`isa.Account.Preferences` — scoped settings document.</summary>
    public AccountPreferences Preferences { get; }

    /// <summary>`isa.Account.Cases` — case CRUD + share.</summary>
    public AccountCases Cases { get; }

    /// <summary>`isa.Account.Email` — transactional email enqueue.</summary>
    public AccountEmail Email { get; }

    /// <summary>`isa.Account.ReferenceData` — engine reference-data lookups.</summary>
    public AccountReferenceData ReferenceData { get; }

    internal AccountNamespace(AccountContext ctx)
    {
        Branding = new AccountBranding(ctx);
        Preferences = new AccountPreferences(ctx);
        Cases = new AccountCases(ctx);
        Email = new AccountEmail(ctx);
        ReferenceData = new AccountReferenceData(ctx);
    }

    /// <summary>Bridge between <see cref="global::Isa.Sdk.IsaClient"/> and the
    /// Account surface. Every constructed <see cref="ZyInsClient"/> carries a
    /// signed <see cref="OperationContext"/> regardless of identity, so the
    /// returned namespace dispatches live under bearer, license, and session
    /// alike. License-mode clients additionally pass their
    /// <see cref="IsaCredentialState"/> so sub-clients can surface
    /// scope/email/order; bearer and session clients pass none.</summary>
    public static AccountNamespace FromZyInsClient(ZyInsClient client)
    {
        if (client is null) throw new ArgumentNullException(nameof(client));
        return new AccountNamespace(AccountContext.FromClient(client, client.CredentialState));
    }
}

/// <summary>Per-operation context shared by every Account sub-client. Wraps
/// the underlying <see cref="ZyInsClient"/> dispatcher and, on license-mode
/// clients, the shared credential state.</summary>
internal sealed class AccountContext
{
    /// <summary>Operation context handed to <see cref="HttpDispatcher"/>.</summary>
    internal OperationContext Op { get; }

    /// <summary>Share-link viewer origin for <c>cases.Share</c>.</summary>
    internal string CaseViewerBaseUrl { get; } = CaseLink.DefaultViewerBaseUrl;

    /// <summary>Case AES-GCM envelope helper for <c>cases.Share</c> / <c>cases.Open</c>.</summary>
    internal CaseCrypto CaseCrypto { get; } = new CaseCrypto();

    /// <summary>Shared credential state — present on license-mode clients so
    /// the sub-client can surface scope/email/order. Null under bearer and
    /// session identities, which carry no per-license credential.</summary>
    internal IsaCredentialState? State { get; }

    private AccountContext(OperationContext op, IsaCredentialState? state)
    {
        Op = op;
        State = state;
    }

    internal static AccountContext FromClient(ZyInsClient client, IsaCredentialState? state) =>
        new(client.Context, state);

    internal OperationContext RequireOp() => Op;
}

