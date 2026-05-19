<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Resolves the bearer credential for the next request.
 *
 * Implementations MAY refresh on demand; the helper does not cache the
 * value across calls. Throw to fail the request before any network
 * activity occurs.
 */
interface TokenSource
{
    public function token(): string;
}
