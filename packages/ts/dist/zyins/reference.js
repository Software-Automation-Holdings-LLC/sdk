/**
 * Back-compat shim for `zyins/reference`. The canonical implementation
 * now lives in `zyins/reference/` (see `./reference/index.ts`); this file
 * re-exports the new types + adds the legacy bundle-taking helpers
 * (`matchMedication(text, bundle)`, ...) used by callers that still
 * thread a `DatasetBundleV3` through directly (e.g. the conformance
 * corpus, the products catalog builder).
 *
 * New code should use `isa.zyins.reference.medications.match(text)` —
 * the bundle is cached inside the facade.
 */
import { ReferenceIndex, buildUnknownConcept, } from './reference/referenceIndex';
import { _makeKey } from './reference/_makeKey';
export { Sort } from './reference/Sort';
// Bundle-scoped index cache so repeated `matchMedication` calls against
// the same bundle reuse one ReferenceIndex.
const INDEX_CACHE = new WeakMap();
function indexFor(bundle) {
    const cached = INDEX_CACHE.get(bundle);
    if (cached !== undefined)
        return cached;
    const built = new ReferenceIndex(bundle);
    INDEX_CACHE.set(bundle, built);
    return built;
}
/**
 * Resolve free text against the medication catalog using an explicit
 * bundle. Returns a `MedicationConcept` on a hit; returns an unknown
 * handle on a miss. Never rejects.
 *
 * Prefer the facade form `isa.zyins.reference.medications.match(text)`
 * which manages the bundle for you.
 */
export function matchMedication(text, bundle) {
    return indexFor(bundle).lookupMedication(text);
}
/**
 * Resolve free text against the condition catalog using an explicit
 * bundle. Returns a `ConditionConcept` on a hit; returns an unknown
 * handle on a miss. Never rejects.
 */
export function matchCondition(text, bundle) {
    return indexFor(bundle).lookupCondition(text);
}
/**
 * Resolve free text against the catalog without specifying a kind.
 * Tries conditions first ("the user typed a symptom"), then medications.
 * Never rejects.
 */
export function matchConcept(text, bundle) {
    return indexFor(bundle).lookupConcept(text);
}
/**
 * Build an unknown handle directly. Exported for callers that need to
 * synthesize a placeholder concept without a catalog.
 */
export { buildUnknownConcept };
/**
 * Testing hook — exported so the conformance corpus can assert that the
 * internal normalizer matches the server-side `MakeKey`. Not part of the
 * public consumer surface; lives behind a `__internal` prefix.
 */
export const __internal = {
    makeKey: _makeKey,
};
//# sourceMappingURL=reference.js.map