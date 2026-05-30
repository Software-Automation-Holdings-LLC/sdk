/**
 * `Autocorrector` — free-text typo correction for picker UIs.
 *
 * The interface accepts free text and returns the same text with known
 * typos rewritten. Mode governs typing-state heuristics:
 *   - `'keyup'`: live correction during typing. Skip a correction whose
 *     RHS contains the typed token AND is longer — prevents `ASTHM` from
 *     prematurely becoming `ASTHMA` while still typing.
 *   - `'submit'`: post-commit correction. Skip a correction whose RHS is
 *     already present in the surrounding text — prevents
 *     `HIGH CHOLESTEROL` from becoming `HIGH HIGH CHOLESTEROL`.
 *
 * Algorithm parity: the default implementation is a direct port of
 * `bpp2.0/src/sah-ui/Input/TextField/useAutocorrect.js` (the n-gram
 * sliding window over uppercase tokens). Semantically identical so the
 * SDK can replace the bpp2.0 hook drop-in.
 *
 * @example
 * ```ts
 * // Domain-bound (typoMap pre-loaded from zyins datasets):
 * const corrected = isa.zyins.autocorrector.correct('hyprtension', { mode: 'keyup' });
 * // → 'HYPERTENSION'
 *
 * // Custom typo map (top-level kernel):
 * const corrector = isa.autocorrector.create({
 *   typoMap: new Map([['HYPRTENSION', 'HYPERTENSION']]),
 * });
 * corrector.correct('hyprtension', { mode: 'submit' });
 * ```
 *
 * Substitution: replace via {@link DefaultAutocorrector.clone} or pass
 * a custom `Autocorrector` to {@link Isa.withKeycode}.
 */
export interface Autocorrector {
    /**
     * Apply typo corrections to free-text input.
     *
     * Never throws. Empty input returns empty. Trailing whitespace on the
     * input is preserved on the output so cursor positioning in a text
     * field remains stable across edits.
     */
    correct(text: string, options: AutocorrectOptions): string;
}
/** Mode + per-call options for {@link Autocorrector.correct}. */
export interface AutocorrectOptions {
    /**
     * Typing-state mode. `'keyup'` for live correction during typing;
     * `'submit'` for post-commit (blur, enter, form submit) correction.
     */
    readonly mode: 'keyup' | 'submit';
}
/** Event emitted by {@link DefaultAutocorrector.onApplied}. */
export interface AutocorrectAppliedEvent {
    /** Pre-correction input, verbatim. */
    readonly input: string;
    /** Post-correction output. */
    readonly output: string;
    /** Mode the consumer passed. */
    readonly mode: 'keyup' | 'submit';
}
/** Constructor options for {@link DefaultAutocorrector}. */
export interface DefaultAutocorrectorOptions {
    /**
     * Map of UPPERCASE input → UPPERCASE correction. Keys MUST be the
     * normalized form (uppercase tokens, joined by a single space).
     * Conventionally sourced from
     * `isa.zyins.datasets.spellingCorrections.items`.
     */
    readonly typoMap: ReadonlyMap<string, string>;
    /**
     * Optional version stamp for the typo map. Surface via {@link
     * DefaultAutocorrector.versionTag} so consumers can detect a stale
     * binding and refresh it.
     */
    readonly versionTag?: string;
    /**
     * Optional sink invoked whenever a correction actually changes the
     * text. Useful for analytics ("user typed X, we corrected to Y").
     * Fires AFTER the text is computed and BEFORE `correct()` returns.
     */
    readonly onApplied?: (event: AutocorrectAppliedEvent) => void;
}
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
export declare class DefaultAutocorrector implements Autocorrector {
    private readonly typoMap;
    private readonly _versionTag;
    private readonly _onApplied;
    constructor(opts: DefaultAutocorrectorOptions);
    /** Opaque tag tracking the version of the typo map this corrector binds. */
    get versionTag(): string | undefined;
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
    correct(text: string, options: AutocorrectOptions): string;
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
    clone(overrides?: Partial<DefaultAutocorrectorOptions>): DefaultAutocorrector;
}
//# sourceMappingURL=Autocorrector.d.ts.map