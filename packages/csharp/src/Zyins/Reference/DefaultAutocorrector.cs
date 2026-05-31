// <c>DefaultAutocorrector</c> — line-for-line semantic port of
// <c>bpp2.0/src/sah-ui/Input/TextField/useAutocorrect.js</c>.
//
// Algorithm (spec §2):
//   1. Tokenize on whitespace; uppercase every token.
//   2. For windowSize = 1..wordCount, slide every contiguous n-gram.
//   3. Lookup the joined window in <c>typoMap</c>.
//   4. Keyup guard: skip if correction startsWith-includes the input AND
//      the correction is longer (mid-typing extension protection).
//   5. Submit guard: skip if the uppercased input already includes the
//      correction (anti-duplication: "HIGH CHOLESTEROL" stays as-is).
//   6. On match: write the correction into the output slot, mark every
//      covered position as processed, advance windowSize past the match.
//   7. Fill un-corrected positions verbatim.
//   8. Re-join with single-space separator + preserve trailing whitespace.
//
// Diverges from JS in one place by design: the JS uses object-property
// existence checks (<c>typoMap[word] === undefined</c>); C# uses
// dictionary <c>TryGetValue</c>. Semantics match: a missing key skips
// the window.
using System;
using System.Collections.Generic;
using System.Text;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Reference implementation of <see cref="IAutocorrector"/>.
/// Build with a typoMap (the projection of the
/// <c>spelling_corrections</c> dataset). Clone with overrides to swap a
/// single field without rebuilding the map.</summary>
public sealed class DefaultAutocorrector : IAutocorrector
{
    private static readonly char[] Whitespace = new[] { ' ', '\t', '\n', '\r', '\v', '\f' };

    private readonly IReadOnlyDictionary<string, string> _typoMap;
    private readonly Action<AutocorrectorAppliedEvent>? _onApplied;

    /// <summary>Build with a typoMap. Keys MUST be uppercased ahead of
    /// time — the JS source already uppercases lookups, so the SDK
    /// expects the consumer to ship an uppercased map.</summary>
    /// <param name="typoMap">From → To. Required, non-null.</param>
    /// <param name="versionTag">Optional catalog version pin.</param>
    /// <param name="onApplied">Optional telemetry callback.</param>
    public DefaultAutocorrector(
        IReadOnlyDictionary<string, string> typoMap,
        string? versionTag = null,
        Action<AutocorrectorAppliedEvent>? onApplied = null)
    {
        _typoMap = typoMap ?? throw new ArgumentNullException(nameof(typoMap));
        VersionTag = versionTag;
        _onApplied = onApplied;
    }

    /// <inheritdoc/>
    public string? VersionTag { get; }

    /// <summary>Return a copy with selected fields overridden. The
    /// typoMap is shared unless replaced; the callback is replaced
    /// outright (no chaining).</summary>
    public DefaultAutocorrector Clone(
        IReadOnlyDictionary<string, string>? typoMap = null,
        string? versionTag = null,
        Action<AutocorrectorAppliedEvent>? onApplied = null)
        => new(typoMap ?? _typoMap, versionTag ?? VersionTag, onApplied ?? _onApplied);

    /// <inheritdoc/>
    public string Correct(string text, AutocorrectOptions? options = null)
    {
        if (string.IsNullOrEmpty(text)) return text ?? string.Empty;
        var mode = options?.Mode ?? AutocorrectMode.Submit;
        var trailingWhitespace = text.EndsWith(" ", StringComparison.Ordinal) ? " " : string.Empty;
        var upperText = text.ToUpperInvariant();
        var words = upperText.Split(Whitespace, StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0) return text;

        var slots = new string?[words.Length];
        var taken = new bool[words.Length];

        for (var numWords = 0; numWords < words.Length; numWords++)
        {
            for (var i = 0; i < words.Length; i++)
            {
                var end = i + numWords + 1;
                if (end > words.Length) continue;
                var window = string.Join(" ", words, i, numWords + 1);
                if (!_typoMap.TryGetValue(window, out var correction)) continue;
                if (!ShouldCorrect(window, correction, upperText, mode)) continue;

                slots[i] = correction;
                for (var n = 0; n <= numWords && i + n < words.Length; n++)
                {
                    taken[i + n] = true;
                }
                _onApplied?.Invoke(new AutocorrectorAppliedEvent(window, correction, numWords + 1, mode));
                numWords += numWords + 1 - 1; // mirror JS `numWords += toAdd.length - 1`
                break;
            }
        }

        var sb = new StringBuilder(text.Length + 16);
        var first = true;
        for (var i = 0; i < words.Length; i++)
        {
            string? piece;
            if (slots[i] is not null) piece = slots[i];
            else if (taken[i]) continue;
            else piece = words[i];
            if (!first) sb.Append(' ');
            sb.Append(piece);
            first = false;
        }
        sb.Append(trailingWhitespace);
        return sb.ToString();
    }

    private static bool ShouldCorrect(string window, string correction, string upperText, AutocorrectMode mode)
    {
        if (mode == AutocorrectMode.Keyup)
        {
            // Skip if correction prefix-extends the input mid-typing.
            var upperCorrection = correction.ToUpperInvariant();
            return !(upperCorrection.IndexOf(window, StringComparison.Ordinal) >= 0
                && correction.Length > window.Length);
        }
        // Submit mode: skip when the upper text already includes the correction
        // verbatim — prevents HIGH CHOLESTEROL → HIGH HIGH CHOLESTEROL.
        return upperText.IndexOf(correction, StringComparison.Ordinal) < 0;
    }
}
