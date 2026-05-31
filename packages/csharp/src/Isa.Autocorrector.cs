// <c>Isa.Autocorrector</c> — top-level static factory for the generic
// autocorrect kernel. Mirrors the locked-spec TS surface
// (<c>isa.autocorrector.create({ typoMap })</c>). Domain-bound
// pre-wired adapters live on the product sub-clients (e.g.
// <c>isa.Zyins.Autocorrector</c>).
//
// The factory is the only documented entry point for constructing a
// <see cref="DefaultAutocorrector"/> from a bare typoMap. Consumers
// implementing a custom <see cref="IAutocorrector"/> SHOULD construct
// their own instance directly and inject via
// <c>Isa.Builder.WithAutocorrector(...)</c>.
using System;
using System.Collections.Generic;
using Isa.Sdk.Zyins.Reference;

namespace Isa.Sdk;

public sealed partial class Isa
{
    /// <summary>Static factory namespace for the generic autocorrect
    /// kernel. Reachable as <c>Isa.Autocorrector.Create(typoMap)</c>.</summary>
    public static class Autocorrector
    {
        /// <summary>Create a <see cref="DefaultAutocorrector"/> bound to
        /// the supplied typoMap. The typoMap should be uppercased ahead
        /// of time — the default impl expects keys to be uppercase.</summary>
        /// <param name="typoMap">From → To. Required, non-null.</param>
        /// <param name="versionTag">Optional catalog version pin.</param>
        /// <param name="onApplied">Optional telemetry callback.</param>
        /// <example>
        /// <code>
        /// var corrector = Isa.Autocorrector.Create(new Dictionary&lt;string,string&gt;
        /// {
        ///     ["HYPRTENSION"] = "HYPERTENSION",
        /// });
        /// </code>
        /// </example>
        public static IAutocorrector Create(
            IReadOnlyDictionary<string, string> typoMap,
            string? versionTag = null,
            Action<AutocorrectorAppliedEvent>? onApplied = null)
            => new DefaultAutocorrector(typoMap, versionTag, onApplied);
    }
}
