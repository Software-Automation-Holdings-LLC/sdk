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
import type { Concept } from './Concept.js';
/**
 * One ranked suggestion produced by an `AutocompleteAlgorithm`.
 *
 * Suggestions are immutable handles. The Concept methods on the suggestion
 * delegate to the underlying catalog-backed handle that produced it.
 */
export interface Suggestion extends Concept {
    /** Query-relative score; higher is better. Not comparable across queries. */
    readonly score: number;
    /**
     * `[startInclusive, endExclusive)` indices on this suggestion's
     * display `name` where the query matched. Use to highlight the
     * matched substring in a picker UI.
     *
     * `[0, 0]` when there is no contiguous span (e.g. bucket-only match).
     */
    readonly matchedSpan: readonly [number, number];
    /** 0-based position within the full ranked list. Stable per query. */
    readonly rank: number;
}
/**
 * Construct a `Suggestion` by decorating an existing `Concept` handle.
 *
 * The decorator preserves every Concept method by delegating; it never
 * mutates the source handle. Callers MAY pass the same `Concept` to many
 * suggestion records — each gets its own rank/score/span without aliasing.
 */
export declare function buildSuggestion(concept: Concept, meta: {
    score: number;
    matchedSpan: readonly [number, number];
    rank: number;
}): Suggestion;
//# sourceMappingURL=Suggestion.d.ts.map