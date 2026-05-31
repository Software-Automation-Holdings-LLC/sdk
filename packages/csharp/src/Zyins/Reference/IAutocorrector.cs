// <c>Isa.Sdk.Zyins.Reference.IAutocorrector</c> — text → corrected text.
//
// Locked-spec adapter (rc.1 §2). Mirrors the canonical TS interface
// (deferred until 1.x) and the Go / Python / PHP equivalents. Default
// implementation lives in <see cref="DefaultAutocorrector"/>; consumers
// supply a custom one to swap the algorithm wholesale via
// <c>IsaBuilder.WithAutocorrector(...)</c>.
//
// Construction options:
//   - <c>typoMap</c> — required. The pre-projected From→To map (the
//     spelling_corrections dataset's row projection).
//   - <c>versionTag</c> — optional. Mirrors the dataset's
//     <c>catalog_version</c> for downstream observability.
//   - <c>onApplied</c> — optional. Fires whenever a correction lands;
//     surfaces a <see cref="AutocorrectorAppliedEvent"/> for telemetry.
//
// Tier 1 invariants:
//   - Public types live in <c>Isa.Sdk.Zyins.Reference</c>.
//   - The interface stays minimal: one method, one struct argument.
//   - Default-impl factories on <see cref="Isa.Sdk.Isa.AutocorrectorFactory"/>
//     and <see cref="Isa.Sdk.Zyins.ZyInsClient.Autocorrector"/>.
using System.Collections.Generic;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Heuristic mode for <see cref="IAutocorrector.Correct"/>.</summary>
public enum AutocorrectMode
{
    /// <summary>Mid-typing — apply only corrections that do NOT prefix-extend
    /// the user's current word. Prevents "ASTHM" → "ASTHMA" while typing.</summary>
    Keyup = 0,

    /// <summary>Final pass on submit — apply every match, except when the
    /// correction is already present in the surrounding text (prevents
    /// "HIGH CHOLESTEROL" → "HIGH HIGH CHOLESTEROL").</summary>
    Submit = 1,
}

/// <summary>Options struct for <see cref="IAutocorrector.Correct"/>.
/// Carried as a record so future fields (e.g. locale) ship as additive
/// changes that don't break the interface signature.</summary>
public sealed record AutocorrectOptions(AutocorrectMode Mode);

/// <summary>Telemetry event fired by <see cref="DefaultAutocorrector"/>
/// when a correction lands. <c>From</c> + <c>To</c> mirror the typoMap
/// row that triggered; <c>WindowSize</c> is the number of input words the
/// match spanned.</summary>
public sealed record AutocorrectorAppliedEvent(string From, string To, int WindowSize, AutocorrectMode Mode);

/// <summary>Free-text → corrected-text adapter. Tier-1 surface.</summary>
/// <example>
/// <code>
/// var corrector = Isa.Autocorrector.Create(new Dictionary&lt;string,string&gt;
/// {
///     ["HYPRTENSION"] = "HYPERTENSION",
/// });
/// var fixed = corrector.Correct("hyprtension", new AutocorrectOptions(AutocorrectMode.Submit));
/// // → "HYPERTENSION"
/// </code>
/// </example>
public interface IAutocorrector
{
    /// <summary>Apply typo corrections to free-text input. Implementations
    /// MUST NOT throw on empty or whitespace-only input — return the input
    /// verbatim.</summary>
    /// <param name="text">Free-text input. Casing is preserved on
    /// non-corrected tokens by default-impl convention; custom adapters
    /// may diverge.</param>
    /// <param name="options">Mode + future tunables. <c>null</c> defaults
    /// to <see cref="AutocorrectMode.Submit"/>.</param>
    /// <returns>The corrected text; never null.</returns>
    string Correct(string text, AutocorrectOptions? options = null);

    /// <summary>Dataset version this adapter is bound to. <c>null</c>
    /// when the adapter is dataset-agnostic.</summary>
    string? VersionTag { get; }
}
