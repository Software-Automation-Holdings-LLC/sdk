/**
 * Typed value objects for `POST /v2/prequalify`. See `prequalify-v2.ts`
 * for the operation entry point. These shapes mirror the OpenAPI schemas
 * (`PlanOffer`, `OtherOffer`, `OfferPremium`, ...) so consumers reading
 * the public spec see the same names verbatim.
 *
 * Field-name policy:
 *  - Wire-shape value objects preserve server snake_case (`rate_class`,
 *    `other_offers`, `coverage_tier`, ...) — these are the OpenAPI fields.
 *  - Top-level envelope metadata follows the `Envelope<T>` camelCase
 *    convention (`requestId`, `idempotencyKey`).
 */
export {};
//# sourceMappingURL=prequalify-v2-types.js.map