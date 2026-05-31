// Per-surface API version table. Locked by the v3 freeze plan
// (PR #360, docs/sdk-syntax-proposal.md §2.7): the API is a federation
// of independently versioned surfaces — there is no single "current"
// version. Consumers audit "what does this release talk to?" by
// reading this map. Override at construction time via
// IsaOptions.ApiVersion (per-surface map); per-call resolution is
//
//     opts.ApiVersion?[surface] ?? BundledApiVersions.Map[surface]
//
// No default key. No scalar/string-shorthand form.
//
// Mirrored across SDKs:
//   - TS:   BundledApiVersions (packages/ts/src/zyins/bundledApiVersions.ts)
//   - Py:   BUNDLED_API_VERSIONS
//   - Go:   BundledAPIVersions
//   - PHP:  BundledApiVersions::MAP
using System.Collections.Generic;

namespace Isa.Sdk.Zyins.Options;

/// <summary>
/// Frozen per-surface table of API versions this SDK release talks to.
/// Locked by PR #360; see <c>docs/sdk-syntax-proposal.md §2.7</c>.
/// </summary>
public static class BundledApiVersions
{
    /// <summary>
    /// Per-surface bundled version. Lookup keys are stable surface
    /// identifiers (<c>prequalify</c>, <c>quote</c>, <c>datasets</c>,
    /// <c>reference</c>, <c>sessions</c>, <c>branding</c>, <c>cases</c>).
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IsaApiVersion> Map =
        new Dictionary<string, IsaApiVersion>
        {
            ["prequalify"] = IsaApiVersion.V2,
            ["quote"] = IsaApiVersion.V2,
            ["datasets"] = IsaApiVersion.V2,
            ["reference"] = IsaApiVersion.V2,
            ["sessions"] = IsaApiVersion.V1,
            ["branding"] = IsaApiVersion.V1,
            ["cases"] = IsaApiVersion.V1,
        };
}
