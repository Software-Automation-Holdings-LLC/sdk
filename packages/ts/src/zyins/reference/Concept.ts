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

import type { Sort } from './Sort.js';

/** Discriminator on a concept handle. */
export type ConceptKind = 'medication' | 'condition' | 'unknown';

export interface Concept {
  /**
   * Opaque entity identifier. Today equals the server-side `make_key`
   * normalized form (e.g. `HIGHBLOODPRESSURE`); tomorrow may be
   * `cond_<ULID>` / `med_<ULID>`. Treat as a stable opaque token.
   * `null` when `kind === 'unknown'`.
   */
  readonly id: string | null;
  /**
   * Human-readable display name from the catalog. When `isKnown` is
   * false, this falls back to `inputText` so the UI always has
   * something to render.
   */
  readonly name: string;
  /** Discriminator. `'unknown'` when `isKnown` is false. */
  readonly kind: ConceptKind;
  /** Whether the input text matched a known catalog entity. */
  readonly isKnown: boolean;
  /** The original input text passed to `match()`. Preserved verbatim. */
  readonly inputText: string;

  /**
   * Conditions associated with this concept. Defined on medication
   * handles; on a condition or unknown handle returns an empty array.
   * Default sort: `Sort.MostCommonFirst`.
   */
  conditions(sort?: Sort): readonly ConditionConcept[];

  /**
   * Medications associated with this concept. Defined on condition
   * handles; on a medication or unknown handle returns an empty array.
   * Default sort: `Sort.MostCommonFirst`.
   */
  medications(sort?: Sort): readonly MedicationConcept[];

  /**
   * Id-based equality: two concepts are equal when both are `isKnown`
   * and share the same `id`. Two unknown handles are never equal — they
   * have no stable identity. Case-insensitive input (`'INSULIN'` vs
   * `'insulin'`) resolves to the same `id`, so equality holds.
   */
  equals(other: Concept): boolean;
}

/** A `Concept` whose `kind` is statically known to be `'medication'`. */
export interface MedicationConcept extends Concept {
  readonly kind: 'medication';
}

/** A `Concept` whose `kind` is statically known to be `'condition'`. */
export interface ConditionConcept extends Concept {
  readonly kind: 'condition';
}

/** A `Concept` whose `kind` is statically known to be `'unknown'`. */
export interface UnknownConcept extends Concept {
  readonly kind: 'unknown';
  readonly isKnown: false;
  readonly id: null;
}
