/**
 * `MatchAlgorithm` — text → single Concept resolution.
 *
 * The default normalizes input via `_makeKey` (uppercase + strip non-
 * alphanumeric) and looks up the resulting key against candidate names
 * and ids. This matches the server-side `MakeKey` so SDK ↔ server
 * identity holds while still supporting opaque catalog ids.
 *
 * Substitute when:
 *   - The product needs fuzzy matching (Levenshtein, trigram, etc.).
 *   - The catalog uses a different normalization (locale-aware
 *     casefolding, transliteration).
 *   - You want to wholesale-replace the lookup path while keeping the
 *     symmetric-traversal accessors.
 *
 * @example
 * ```ts
 * // Replace the default at construction time:
 * const isa = await Isa.withKeycode({
 *   keycode, email,
 *   matchAlgorithm: new MyFuzzyMatcher({ threshold: 0.8 }),
 * });
 * ```
 */
import { _makeKey } from './_makeKey.js';
import { buildUnknownConcept } from './referenceIndex.js';
/**
 * Default matcher. Normalizes query, candidate names, and candidate IDs via the
 * server-mirrored `make_key`, then does an exact-equality lookup.
 *
 * Synchronous, dependency-free, safe to share across concurrent calls.
 *
 * @example
 * ```ts
 * const matcher = new DefaultMatchAlgorithm({ versionTag: 'v1' });
 * const hit = matcher.match('high blood pressure', conditions);
 * // hit.id === 'HIGHBLOODPRESSURE'
 * ```
 */
export class DefaultMatchAlgorithm {
    _versionTag;
    constructor(opts = {}) {
        this._versionTag = opts.versionTag;
    }
    /** Opaque tag tracking the version of this matcher. */
    get versionTag() {
        return this._versionTag;
    }
    match(query, candidates) {
        const key = _makeKey(query);
        if (!key)
            return buildUnknownConcept(query);
        for (const candidate of candidates) {
            if (_makeKey(candidate.name) === key) {
                return candidate;
            }
            if (candidate.id !== null && _makeKey(candidate.id) === key) {
                return candidate;
            }
        }
        return buildUnknownConcept(query);
    }
    /** Return a new matcher with selected fields overridden. */
    clone(overrides = {}) {
        const nextVersionTag = overrides.versionTag ?? this._versionTag;
        return new DefaultMatchAlgorithm(nextVersionTag !== undefined ? { versionTag: nextVersionTag } : {});
    }
}
//# sourceMappingURL=MatchAlgorithm.js.map