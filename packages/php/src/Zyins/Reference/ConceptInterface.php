<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Handle returned by every `match()`. Never thrown on unknown text —
 * unknown input yields a handle with `isKnown() === false`, `id()` of
 * `null`, and `inputText()` preserved.
 *
 * `kind()` returns one of the {@see ConceptKind} string constants:
 * `ConceptKind::MEDICATION`, `ConceptKind::CONDITION`, or
 * `ConceptKind::UNKNOWN`. Sort accessors take one of the {@see Sort}
 * constants.
 *
 * Aliases are intentionally absent: they're resolved server-side and
 * not surfaced; consumers compare on `id()` instead via {@see equals()}.
 */
interface ConceptInterface
{
    /** Opaque entity id; `null` when `isKnown()` is false. */
    public function id(): ?string;

    /** Display name; falls back to `inputText()` when unknown. */
    public function name(): string;

    /** One of the {@see ConceptKind} string constants. */
    public function kind(): string;

    public function isKnown(): bool;

    /** Verbatim input passed to `match()`. */
    public function inputText(): string;

    /**
     * Conditions associated with this concept. Empty on unknown or
     * condition handles; populated on medication handles. Sort defaults
     * to {@see Sort::MOST_COMMON_FIRST}.
     *
     * @param Sort::* $sort
     * @return list<ConceptInterface>
     */
    public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array;

    /**
     * Medications associated with this concept. Empty on unknown or
     * medication handles; populated on condition handles. Sort defaults
     * to {@see Sort::MOST_COMMON_FIRST}.
     *
     * @param Sort::* $sort
     * @return list<ConceptInterface>
     */
    public function medications(string $sort = Sort::MOST_COMMON_FIRST): array;

    /**
     * Structural equality. Two concepts are equal iff they share the
     * same kind and the same id. Unknown concepts compare equal when
     * their normalized {@see MakeKey} of `inputText()` matches — this
     * lets two unknown handles for the same raw input recognize each
     * other across calls.
     */
    public function equals(ConceptInterface $other): bool;
}
