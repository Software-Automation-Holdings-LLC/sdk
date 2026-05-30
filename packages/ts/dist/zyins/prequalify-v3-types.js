/**
 * Typed value objects for `POST /v3/prequalify` and `POST /v3/quote`.
 * The v3 contract collapses v2's `premium` + `other_offers` split into
 * one uniform `pricing[]` table per product. Money is always integer
 * cents paired with a server-formatted `display` string; there is no
 * string-money path anywhere.
 *
 * Shape over helpers: consumers iterate `offer.pricing` directly,
 * filter rows on `row.eligibility.eligible`, and trust array order for
 * display. There are no synthetic indexes, no client-side sort keys.
 */
export {};
//# sourceMappingURL=prequalify-v3-types.js.map