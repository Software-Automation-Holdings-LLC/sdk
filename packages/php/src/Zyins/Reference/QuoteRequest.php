<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * De-versioned canonical name for {@see QuoteV3Request}. Thin subclass so
 * static analysis resolves it and it is accepted everywhere a
 * QuoteV3Request is expected; `new QuoteRequest(...)` inherits the parent's
 * promoted constructor. The quote call site is unversioned —
 * `$isa->zyins->quote` routes per the bundled version table. See
 * api/guides/api-version-pinning.md.
 */
readonly class QuoteRequest extends QuoteV3Request
{
}
