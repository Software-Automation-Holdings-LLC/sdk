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
// The namespace targets the License-HMAC auth path the rest of the
// ZyINS client already uses; bearer / session identities receive a stub
// namespace whose first method call throws at the boundary.
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

    /// <summary>Bridge between <see cref="global::Isa.Sdk.Isa"/> and the per-license
    /// Account surface. License-mode clients return a live namespace; other
    /// identities return a stub whose first method throws
    /// <see cref="IsaConfigException"/>.</summary>
    public static AccountNamespace FromZyInsClient(ZyInsClient client)
    {
        if (client is null) throw new ArgumentNullException(nameof(client));
        if (client.CredentialState is null)
        {
            return new AccountNamespace(AccountContext.Throwing(
                "isa.Account.* methods currently require Isa.WithLicense() — bearer/session transport wiring lands in Phase 3 of SDK_DESIGN.md"));
        }
        return new AccountNamespace(AccountContext.FromClient(client, client.CredentialState));
    }
}

/// <summary>Per-operation context shared by every Account sub-client. Wraps
/// the underlying <see cref="ZyInsClient"/> dispatcher and the shared
/// credential state.</summary>
internal sealed class AccountContext
{
    /// <summary>Operation context handed to <see cref="HttpDispatcher"/>.</summary>
    internal OperationContext? Op { get; }

    /// <summary>Shared credential state — needed for snapshot when the
    /// sub-client wants to surface scope/email/order.</summary>
    internal IsaCredentialState? State { get; }

    /// <summary>Error message to surface when the namespace was constructed
    /// without a valid identity (bearer / session). Null on live contexts.</summary>
    internal string? StubMessage { get; }

    private AccountContext(OperationContext? op, IsaCredentialState? state, string? stubMessage)
    {
        Op = op;
        State = state;
        StubMessage = stubMessage;
    }

    internal static AccountContext FromClient(ZyInsClient client, IsaCredentialState state) =>
        new(client.Context, state, stubMessage: null);

    internal static AccountContext Throwing(string message) =>
        new(op: null, state: null, stubMessage: message);

    internal OperationContext RequireOp()
    {
        if (Op is null)
            throw new IsaConfigException(StubMessage ?? "Account namespace is not configured for the current identity.");
        return Op;
    }
}

