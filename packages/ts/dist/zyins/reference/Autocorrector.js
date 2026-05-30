/**
 * Default autocorrector. Implements the n-gram sliding-window algorithm
 * from the bpp2.0 picker hook.
 *
 * Single-threaded, synchronous, dependency-free. Safe to share across
 * concurrent calls — the instance holds no mutable per-call state.
 *
 * @example
 * ```ts
 * const corrector = new DefaultAutocorrector({
 *   typoMap: new Map([['HYPRTENSION', 'HYPERTENSION']]),
 *   versionTag: '2026.05.29',
 *   onApplied: (e) => analytics.track('autocorrect', e),
 * });
 *
 * corrector.correct('hyprtension', { mode: 'submit' });
 * // → 'HYPERTENSION'
 *
 * // Replace the typo map without losing the listener:
 * const next = corrector.clone({ typoMap: freshMap, versionTag: '2026.06.01' });
 * ```
 */
export class DefaultAutocorrector {
    typoMap;
    _versionTag;
    _onApplied;
    constructor(opts) {
        this.typoMap = opts.typoMap;
        this._versionTag = opts.versionTag;
        this._onApplied = opts.onApplied;
    }
    /** Opaque tag tracking the version of the typo map this corrector binds. */
    get versionTag() {
        return this._versionTag;
    }
    /**
     * Apply typo corrections.
     *
     * Mirrors the bpp2.0 algorithm:
     *   1. Uppercase the input; tokenize on whitespace.
     *   2. For window size 1..wordCount, slide every contiguous n-gram.
     *   3. Look up the n-gram in `typoMap`. Apply guard for the mode.
     *   4. Replace the matched span; mark positions consumed.
     *   5. Fill non-matched positions with the original (uppercased) word.
     *   6. Reassemble with single-space separator; preserve trailing space.
     */
    correct(text, options) {
        if (!text)
            return text;
        const trailingWhitespace = text.endsWith(' ') ? ' ' : '';
        const upper = text.toUpperCase();
        // Match PHP's PREG_SPLIT_NO_EMPTY / Python's str.split() — drop empty
        // tokens that .split(/\s+/) emits at string boundaries. Otherwise a
        // trailing space produces an empty trailing token that survives all
        // the way to the join and concatenates with `trailingWhitespace` to
        // emit a double space (cross-language SDK contract requires single).
        const words = upper.split(/\s+/).filter((w) => w !== '');
        if (words.length === 0)
            return text;
        if (this.typoMap.size === 0)
            return words.join(' ') + trailingWhitespace;
        const result = new Array(words.length);
        const consumed = new Set();
        let changed = false;
        // Process larger phrases first while keeping each pass to its exact
        // n-gram size; shorter tail slices are handled by later passes.
        for (let windowSize = words.length - 1; windowSize >= 0; windowSize--) {
            for (let i = 0; i < words.length; i++) {
                const ngram = words.slice(i, i + windowSize + 1);
                if (ngram.length !== windowSize + 1)
                    continue;
                const key = ngram.join(' ');
                const correction = this.typoMap.get(key);
                if (correction === undefined)
                    continue;
                const correctionUpper = correction.toUpperCase();
                const shouldCorrect = options.mode === 'keyup'
                    ? !(correctionUpper.includes(key) && correctionUpper.length > key.length)
                    : !containsPhrase(words, correctionUpper);
                if (!shouldCorrect)
                    continue;
                if (result[i] !== undefined)
                    continue;
                if (windowOverlapsConsumed(consumed, i, ngram.length))
                    continue;
                changed = true;
                result[i] = correction;
                const windowLen = ngram.length;
                for (let n = 0; n < windowLen; n++) {
                    const consumedIndex = i + n;
                    if (consumedIndex >= words.length)
                        continue;
                    consumed.add(consumedIndex);
                    if (n > 0)
                        result[consumedIndex] = undefined;
                }
            }
        }
        for (let i = 0; i < words.length; i++) {
            if (result[i] === undefined && !consumed.has(i)) {
                result[i] = words[i];
            }
        }
        // Filter out the undefineds (positions that were absorbed into a
        // multi-word correction at a lower index) before joining.
        const joined = result.filter((x) => x !== undefined).join(' ') + trailingWhitespace;
        if (changed && this._onApplied !== undefined) {
            this._onApplied({ input: text, output: joined, mode: options.mode });
        }
        return joined;
    }
    /**
     * Return a new corrector with selected fields overridden. Useful for
     * swapping the typo map after a fresh dataset bundle arrives without
     * losing the `onApplied` sink.
     *
     * @example
     * ```ts
     * const fresh = corrector.clone({ typoMap: nextMap, versionTag: '2026.06.01' });
     * ```
     */
    clone(overrides = {}) {
        const nextVersionTag = overrides.versionTag ?? this._versionTag;
        const nextOnApplied = overrides.onApplied ?? this._onApplied;
        return new DefaultAutocorrector({
            typoMap: overrides.typoMap ?? this.typoMap,
            ...(nextVersionTag !== undefined && { versionTag: nextVersionTag }),
            ...(nextOnApplied !== undefined && { onApplied: nextOnApplied }),
        });
    }
}
function containsPhrase(words, phrase) {
    const phraseWords = phrase.split(/\s+/).filter((w) => w !== '');
    if (phraseWords.length === 0 || phraseWords.length > words.length)
        return false;
    for (let start = 0; start <= words.length - phraseWords.length; start++) {
        const matches = phraseWords.every((word, offset) => words[start + offset] === word);
        if (matches)
            return true;
    }
    return false;
}
function windowOverlapsConsumed(consumed, start, length) {
    for (let offset = 0; offset < length; offset++) {
        if (consumed.has(start + offset))
            return true;
    }
    return false;
}
//# sourceMappingURL=Autocorrector.js.map