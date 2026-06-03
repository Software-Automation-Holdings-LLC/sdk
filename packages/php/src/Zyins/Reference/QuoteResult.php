<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * De-versioned canonical name for {@see QuoteV3Result}. Thin subclass —
 * the same flat plans[] shape as PrequalifyResult. See
 * api/guides/api-version-pinning.md.
 */
readonly class QuoteResult extends QuoteV3Result
{
}
