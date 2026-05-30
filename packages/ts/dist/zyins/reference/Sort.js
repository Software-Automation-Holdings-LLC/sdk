/**
 * Sort orders for the symmetric accessors on a `Concept`.
 *
 * Namespaced enum — consumers write `reference.Sort.MostCommonFirst` /
 * `reference.Sort.Alphabetical`. No `Sort.Asc` / `Sort.Desc`, no closures,
 * no string aliases. New sort orders ship as new enum members.
 *
 * The constant is `Object.freeze`-d so consumers cannot mutate the public
 * surface at runtime.
 */
export const Sort = Object.freeze({
    /** Sort by descending prescription frequency from the v3 frequency graph. */
    MostCommonFirst: 'most_common_first',
    /** Sort alphabetically (case-insensitive) by display name. */
    Alphabetical: 'alphabetical',
});
//# sourceMappingURL=Sort.js.map