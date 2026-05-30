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
export declare const Sort: Readonly<{
    /** Sort by descending prescription frequency from the v3 frequency graph. */
    readonly MostCommonFirst: "most_common_first";
    /** Sort alphabetically (case-insensitive) by display name. */
    readonly Alphabetical: "alphabetical";
}>;
export type Sort = (typeof Sort)[keyof typeof Sort];
//# sourceMappingURL=Sort.d.ts.map