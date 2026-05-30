/**
 * `Suggestion` — a scored, ranked autocomplete result.
 *
 * Extends `Concept` so consumers can treat a suggestion as a Concept handle
 * (call `.medications(sort)` / `.conditions(sort)` directly) while still
 * accessing the rank metadata that came out of `AutocompleteAlgorithm.rank()`.
 *
 * `score` is the raw `(frequency + 1) * scaleFactor` value the default
 * algorithm produces; consumers MAY use it for tiebreaks or display, but
 * MUST NOT compare scores across queries — they are query-relative.
 *
 * `matchedSpan` is the `[start, endExclusive)` indices on the option's
 * display name where the query text matched. UI layers use this to bold
 * the matched substring.
 *
 * `rank` is the 0-based index of the suggestion in the result list, before
 * the consumer trims it. Useful for analytics ("position 0 selected") even
 * after a paging slice.
 *
 * @example
 * ```ts
 * const ranked = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
 * for (const s of ranked) {
 *   console.log(s.rank, s.name, s.score, s.matchedSpan);
 *   for (const cond of s.conditions(Sort.MostCommonFirst)) {
 *     console.log('  -', cond.name);
 *   }
 * }
 * ```
 */
/**
 * Construct a `Suggestion` by decorating an existing `Concept` handle.
 *
 * The decorator preserves every Concept method by delegating; it never
 * mutates the source handle. Callers MAY pass the same `Concept` to many
 * suggestion records — each gets its own rank/score/span without aliasing.
 */
export function buildSuggestion(concept, meta) {
    return {
        id: concept.id,
        name: concept.name,
        kind: concept.kind,
        isKnown: concept.isKnown,
        inputText: concept.inputText,
        conditions: (sort) => concept.conditions(sort),
        medications: (sort) => concept.medications(sort),
        equals: (other) => concept.equals(other),
        score: meta.score,
        matchedSpan: meta.matchedSpan,
        rank: meta.rank,
    };
}
//# sourceMappingURL=Suggestion.js.map