/**
 * `AutocompleteAlgorithm` — text → ranked Suggestion[].
 *
 * Default: a direct port of the bpp2.0 picker hook
 * (`src/sah-ui/Input/TextField/useAutocomplete.js`). Candidates are
 * categorized into priority buckets, then sorted within each bucket by a
 * `(frequency + 1) * scaleFactor` score where `scaleFactor` decreases
 * as bucket priority drops.
 *
 * Bucket priorities (highest → lowest):
 *   1. `startsWith` — option starts with the literal input
 *      (sub-sort: option.wordCount ascending)
 *   2. `sameWords` — identical word set + same word count
 *   3. `independentWordIntersection` — every input word appears in option
 *   4. `wordCountNoTolerance[d]` — superset; option has `d` extra words
 *      (sub-sort: d ascending)
 *   5. `sameNumWithTolerance` — same word count, different word sets
 *   6. `wordCountWithTolerance[d]` — `d` words differ/extra
 *      (sub-sort: d ascending)
 *
 * The promise wrapper exists so future implementations can do real I/O
 * (server-side reranking, embedding lookup) without an API change; the
 * default resolves synchronously.
 *
 * @example
 * ```ts
 * const ranked = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
 * for (const s of ranked) console.log(s.rank, s.name, s.score);
 * ```
 */
import { Sort } from './Sort.js';
import { buildSuggestion } from './Suggestion.js';
import { _makeKey } from './_makeKey.js';
import { doubleMetaphone } from './_doubleMetaphone.js';
import { FUZZY_MEDIUM_LEN, FUZZY_SHORT_LEN, optimalStringAlignmentDistance } from './_damerauOsa.js';
/**
 * Default ranker. Bucket + frequency-boost algorithm ported from the
 * bpp2.0 picker hook.
 *
 * @example
 * ```ts
 * const ranker = new DefaultAutocompleteAlgorithm({ startOnly: false });
 * const out = await ranker.rank('high blood', candidates, {
 *   limit: 10,
 *   kinds: ['condition'],
 *   frequencies: new Map([['HIGHBLOODPRESSURE', 4120]]),
 * });
 * ```
 */
export class DefaultAutocompleteAlgorithm {
    startOnly;
    fuzzy;
    _versionTag;
    constructor(opts = {}) {
        this.startOnly = opts.startOnly ?? false;
        this.fuzzy = opts.fuzzy ?? true;
        this._versionTag = opts.versionTag;
    }
    /** Opaque tag tracking the version of this ranker. */
    get versionTag() {
        return this._versionTag;
    }
    async rank(query, candidates, options) {
        const ranked = rankSync(query, candidates, options, this.startOnly, this.fuzzy);
        return ranked;
    }
    /** Return a new ranker with selected fields overridden. */
    clone(overrides = {}) {
        const nextVersionTag = overrides.versionTag ?? this._versionTag;
        return new DefaultAutocompleteAlgorithm({
            startOnly: overrides.startOnly ?? this.startOnly,
            fuzzy: overrides.fuzzy ?? this.fuzzy,
            ...(nextVersionTag !== undefined && { versionTag: nextVersionTag }),
        });
    }
}
// ---------------------------------------------------------------------------
// Internal — pure ranking. Separate from the class so the algorithm can be
// unit-tested without the async shell.
// ---------------------------------------------------------------------------
function tokenize(s) {
    return String(s)
        .toUpperCase()
        .split(/\s+/)
        .map((x) => x.replace(/[^A-Z0-9]/g, ''))
        .filter(Boolean);
}
const MAX_LIMIT = 250;
/**
 * The substring filter is considered to have "enough" hits — and the fuzzy
 * fallback is skipped — once it produces this many candidates. Mirrors the
 * intuition that a typo-recovery pass only earns its keep when literal
 * matching comes up nearly empty; a healthy substring hit list is already
 * the better answer.
 */
const FUZZY_FALLBACK_THRESHOLD = 1;
/**
 * Edit-distance ceiling for the autocomplete fuzzy band, by query-unit
 * length. Deliberately one wider than {@link FuzzyMatchAlgorithm}'s
 * single-result band in the medium range: autocomplete shows a RANKED LIST
 * with fuzzy hits in the strict lowest bucket, so a slightly looser net is
 * safe and catches double-edit transpositions the match path rejects
 * (`chrons` → `crohns` is OSA distance 2). The bands:
 *   - shorter than {@link FUZZY_SHORT_LEN}: ≤ 1
 *   - {@link FUZZY_SHORT_LEN}–{@link FUZZY_MEDIUM_LEN}: ≤ 2
 *   - longer: ≤ 2 (the cap)
 */
function autocompleteFuzzyThreshold(unitLength) {
    if (unitLength < FUZZY_SHORT_LEN)
        return 1;
    if (unitLength <= FUZZY_MEDIUM_LEN)
        return 2;
    return 2;
}
function rankSync(query, candidates, options, startOnly, fuzzy) {
    const limit = Math.min(options.limit, MAX_LIMIT);
    if (limit <= 0)
        return [];
    // An empty / whitespace-only query has zero tokens and resolves to no
    // suggestions — guard explicitly so the substring pre-filter (which treats
    // '' as matching every candidate) cannot leak the full catalog. Mirrors the
    // Python reference adapter and the documented contract.
    if (query.trim() === '')
        return [];
    const queryUpper = query.toUpperCase();
    const queryClean = queryUpper.replace(/\(/g, '');
    const queryTokens = tokenize(query);
    // make_key form: uppercase, strip ALL non-alphanumeric. This is what the
    // engine matches on server-side, so `crohns` must reach `Crohn's Disease`
    // — the literal `(`-only strip above leaves the apostrophe in and breaks it.
    const queryKey = _makeKey(query);
    const kindFilter = options.kinds.length > 0 ? new Set(options.kinds) : undefined;
    const inKind = (c) => !kindFilter || kindFilter.has(c.kind);
    // 1. Filter to plausible candidates.
    const filtered = [];
    for (const c of candidates) {
        if (!inKind(c))
            continue;
        const nameUpper = c.name.toUpperCase().replace(/\(/g, '');
        if (startOnly) {
            if (nameUpper.startsWith(queryClean))
                filtered.push(c);
            continue;
        }
        if (queryTokens.length < 2) {
            // Compare on the make_key form (apostrophes, hyphens, etc. stripped
            // from BOTH sides) so a correctly-spelled `crohns` matches
            // `Crohn's Disease`, mirroring the server-side make_key match.
            if (_makeKey(c.name).includes(queryKey))
                filtered.push(c);
            continue;
        }
        // Multi-word query: keep candidates where at most one input word is missing.
        const optTokens = tokenize(c.name);
        const optSet = new Set(optTokens);
        let missing = 0;
        for (const t of queryTokens)
            if (!optSet.has(t))
                missing++;
        if (missing <= 1)
            filtered.push(c);
    }
    // 1b. Typo-tolerant fallback. When the literal filter comes up nearly
    // empty, recover transpositions/phonetic misses (`chrons` → Crohn's,
    // `diabetis` → Diabetes, `tylonol` → Tylenol). Default ON; the
    // `{ fuzzy: false }` opt-out and `startOnly` mode both skip it.
    const filteredKeys = new Set(filtered.map((c) => c.id ?? `__unknown:${c.inputText}:${c.name}`));
    const fuzzyMatches = fuzzy && !startOnly && filtered.length <= FUZZY_FALLBACK_THRESHOLD ? collectFuzzy(queryKey, queryTokens, candidates, inKind, filteredKeys) : [];
    // 2. Bucket.
    const buckets = {
        startsWith: [],
        sameWords: [],
        independentWordIntersection: [],
        wordCountNoTolerance: new Map(),
        sameNumWithTolerance: [],
        wordCountWithTolerance: new Map(),
        fuzzy: fuzzyMatches,
    };
    for (const c of filtered) {
        const cleanedName = c.name.replace(/\(/g, '');
        const optTokens = tokenize(cleanedName);
        const optSet = new Set(optTokens);
        const querySet = new Set(queryTokens);
        const isStart = cleanedName.toUpperCase().startsWith(queryClean);
        const isSameLength = optTokens.length === queryTokens.length;
        const lengthDiff = Math.abs(queryTokens.length - optTokens.length);
        const supersetOfInput = queryTokens.every((t) => optSet.has(t));
        const sameSet = querySet.size === optSet.size && [...querySet].every((x) => optSet.has(x));
        const independentWordIntersection = !supersetOfInput && queryTokens.every((t) => cleanedName.toUpperCase().includes(t));
        if (isStart) {
            buckets.startsWith.push(c);
        }
        else if (isSameLength && sameSet) {
            buckets.sameWords.push(c);
        }
        else if (independentWordIntersection) {
            buckets.independentWordIntersection.push(c);
        }
        else if (supersetOfInput) {
            pushToBucket(buckets.wordCountNoTolerance, lengthDiff, c);
        }
        else if (isSameLength) {
            buckets.sameNumWithTolerance.push(c);
        }
        else {
            pushToBucket(buckets.wordCountWithTolerance, lengthDiff, c);
        }
    }
    // 3. Assemble grouped order. Sub-sort startsWith by option wordCount ascending.
    const startsWithSorted = [...buckets.startsWith].sort((a, b) => tokenize(a.name).length - tokenize(b.name).length);
    const noTolKeys = [...buckets.wordCountNoTolerance.keys()].sort((a, b) => a - b);
    const noTol = noTolKeys.flatMap((k) => buckets.wordCountNoTolerance.get(k) ?? []);
    const withTolKeys = [...buckets.wordCountWithTolerance.keys()].sort((a, b) => a - b);
    const withTol = withTolKeys.flatMap((k) => buckets.wordCountWithTolerance.get(k) ?? []);
    // Fuzzy hits occupy the strict lowest bucket — always below every literal
    // (exact / prefix / substring / word-tolerance) match.
    let groups = [startsWithSorted, buckets.sameWords, buckets.independentWordIntersection, noTol, buckets.sameNumWithTolerance, withTol, buckets.fuzzy];
    // 4. Order within the matched set. Alphabetical flattens every bucket into
    // one A→Z group (the relevance filter already decided membership); the
    // default boosts by frequency within each bucket and keeps bucket priority.
    if (options.sort === Sort.Alphabetical) {
        groups = [flattenAlphabetical(groups)];
    }
    else {
        groups = applyFrequencyBoost(groups, options.frequencies);
    }
    // 5. Dedupe by id (preserve first occurrence across groups) and emit Suggestions.
    const seen = new Set();
    const scoreOf = computeScoreLookup(groups, options.frequencies);
    const result = [];
    let rank = 0;
    for (const group of groups) {
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            const matchedSpan = computeSpan(c.name, queryKey);
            result.push(buildSuggestion(c, {
                score: scoreOf.get(key) ?? 0,
                matchedSpan,
                rank,
            }));
            rank++;
            if (result.length >= limit)
                return result;
        }
    }
    return result;
}
/**
 * Collapse every relevance bucket into one group ordered case-insensitively
 * A→Z by display name. De-dupes by id (first occurrence across buckets wins
 * before the sort) so the same concept appearing in two buckets does not
 * double-list. Ties broken by case-sensitive name then id for stable,
 * cross-language-reproducible output.
 */
function flattenAlphabetical(groups) {
    const seen = new Set();
    const flat = [];
    for (const group of groups) {
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            flat.push(c);
        }
    }
    flat.sort((a, b) => {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        if (an < bn)
            return -1;
        if (an > bn)
            return 1;
        if (a.name < b.name)
            return -1;
        if (a.name > b.name)
            return 1;
        return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0;
    });
    return flat;
}
/**
 * Token-aware typo recovery. For each in-kind candidate not already placed
 * by the literal filter, the query matches when ANY candidate token clears
 * the bar against the corresponding query unit:
 *   - Damerau-OSA distance within the shipped length band, OR
 *   - Double-Metaphone primary-code equality.
 *
 * Matching per-token (not against the whole concatenated name) keeps a short
 * query like `chrons` from being swamped by the edit distance of the rest of
 * a long name (`CROHNSDISEASE`). The query is itself tokenized so a fuzzy
 * multi-word query degrades gracefully. Reuses the same primitives as
 * {@link FuzzyMatchAlgorithm} for cross-language and intra-SDK parity.
 */
function collectFuzzy(queryKey, queryTokens, candidates, inKind, alreadyMatched) {
    if (queryKey.length === 0)
        return [];
    // A single-token query fuzzes on its make_key form; a multi-word query
    // fuzzes each word independently and accepts on any single word hit.
    const queryUnits = queryTokens.length > 1 ? queryTokens : [queryKey];
    const queryCodes = queryUnits.map((u) => doubleMetaphone(u).primary);
    const hits = [];
    for (const c of candidates) {
        if (!inKind(c))
            continue;
        const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
        if (alreadyMatched.has(key))
            continue;
        if (fuzzyMatchesAnyToken(queryUnits, queryCodes, tokenize(c.name)))
            hits.push(c);
    }
    return hits;
}
function fuzzyMatchesAnyToken(queryUnits, queryCodes, candidateTokens) {
    for (let u = 0; u < queryUnits.length; u++) {
        const unit = queryUnits[u] ?? '';
        if (unit.length === 0)
            continue;
        const threshold = autocompleteFuzzyThreshold(unit.length);
        const code = queryCodes[u] ?? '';
        for (const token of candidateTokens) {
            if (token.length === 0)
                continue;
            if (optimalStringAlignmentDistance(unit, token, threshold) <= threshold)
                return true;
            if (code.length > 0 && doubleMetaphone(token).primary === code)
                return true;
        }
    }
    return false;
}
function pushToBucket(map, key, c) {
    const existing = map.get(key);
    if (existing)
        existing.push(c);
    else
        map.set(key, [c]);
}
function applyFrequencyBoost(groups, frequencies) {
    if (frequencies.size === 0)
        return groups;
    const total = groups.length;
    let foundAny = false;
    for (const group of groups) {
        for (const c of group) {
            if (c.id !== null && frequencies.has(c.id)) {
                foundAny = true;
                break;
            }
        }
        if (foundAny)
            break;
    }
    if (!foundAny)
        return groups;
    return groups.map((group, groupIndex) => {
        const scale = Math.max(1, total - groupIndex);
        return [...group].sort((a, b) => {
            const fa = (a.id !== null ? (frequencies.get(a.id) ?? 0) : 0) + 1;
            const fb = (b.id !== null ? (frequencies.get(b.id) ?? 0) : 0) + 1;
            const sa = fa * scale;
            const sb = fb * scale;
            if (sb !== sa)
                return sb - sa;
            // Tie-break alphabetical ascending — spec-aligned.
            return a.name.localeCompare(b.name);
        });
    });
}
function computeScoreLookup(groups, frequencies) {
    const total = groups.length;
    const out = new Map();
    groups.forEach((group, groupIndex) => {
        const scale = Math.max(1, total - groupIndex);
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (out.has(key))
                continue;
            const freq = (c.id !== null ? (frequencies.get(c.id) ?? 0) : 0) + 1;
            out.set(key, freq * scale);
        }
    });
    return out;
}
function computeSpan(name, queryKey) {
    if (!queryKey)
        return [0, 0];
    // Normalize to the make_key form (uppercase, alphanumeric only) while
    // tracking each surviving char's source index, so a query like `crohns`
    // highlights the right run in `Crohn's Disease` even though the
    // apostrophe sits between the matched characters.
    const normalized = [];
    const sourceIndices = [];
    for (let i = 0; i < name.length; i++) {
        const ch = name[i]?.toUpperCase() ?? '';
        const code = ch.charCodeAt(0);
        const isAlnum = (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a);
        if (!isAlnum)
            continue;
        normalized.push(ch);
        sourceIndices.push(i);
    }
    const idx = normalized.join('').indexOf(queryKey);
    if (idx < 0)
        return [0, 0];
    const endSourceIndex = sourceIndices[idx + queryKey.length - 1];
    if (endSourceIndex === undefined)
        return [0, 0];
    return [sourceIndices[idx] ?? 0, endSourceIndex + 1];
}
//# sourceMappingURL=AutocompleteAlgorithm.js.map