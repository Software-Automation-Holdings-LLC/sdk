<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * De-versioned canonical name for {@see PrequalifyV3Result}. Thin subclass
 * so static analysis resolves it and the grouping helper is reachable
 * through the canonical name: `PrequalifyResult::byAmount($plans)`. See
 * api/guides/api-version-pinning.md.
 */
readonly class PrequalifyResult extends PrequalifyV3Result
{
}
