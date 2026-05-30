/**
 * Public Concept handle returned by `reference.*.match()`.
 *
 * `match()` never rejects. Unknown input text returns a handle with
 * `kind: 'unknown'`, `isKnown: false`, `id: null`, and `inputText`
 * preserved verbatim — downstream engine expansion handles the unknown
 * path; an unmatched term is not an error.
 *
 * Symmetric traversal: a `MedicationConcept` exposes `.conditions(sort?)`
 * (which conditions is this med typically prescribed for); a
 * `ConditionConcept` exposes `.medications(sort?)`. Both default to
 * `Sort.MostCommonFirst`.
 *
 * `aliases` is intentionally absent. Aliases are resolved server-side and
 * not surfaced; consumers compare on `id` (use `Concept.equals`).
 */
export {};
//# sourceMappingURL=Concept.js.map