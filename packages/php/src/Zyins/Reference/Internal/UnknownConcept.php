<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Reference\ConceptKind;

/**
 * Concrete handle returned when `match()` fails to resolve the input.
 * `isKnown()` is false, `id()` is null, accessors return empty arrays,
 * and `inputText()` preserves the verbatim input — never throws.
 *
 * Does NOT implement either marker interface — unknown handles can't
 * be narrowed by type, only by `isKnown()`.
 *
 * @internal
 */
final class UnknownConcept extends ConceptHandle
{
    public function __construct(string $inputText)
    {
        parent::__construct(
            id: null,
            name: $inputText,
            kind: ConceptKind::UNKNOWN,
            isKnown: false,
            inputText: $inputText,
            index: null,
        );
    }
}
