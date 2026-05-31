<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One reference catalog entity (medication, condition, product, …).
 *
 * `id` is the opaque entity identifier — today equals the server-side
 * `make_key` normalized form (e.g. `HIGHBLOODPRESSURE`). Treat it as a
 * stable opaque token. `name` is the human-readable display string.
 * Aliases are resolved server-side and intentionally NOT surfaced —
 * consumers compare on `id` instead.
 */
final readonly class ReferenceEntity
{
    public function __construct(
        public string $id,
        public string $name,
    ) {
    }
}
