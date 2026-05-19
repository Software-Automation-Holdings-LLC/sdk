<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Exception;

/**
 * Generic proxy-layer error.
 *
 * Specific failure modes (auth, validation, rate limiting, Algosure
 * salt resolution, integration not found) extend this class. Callers
 * may catch `ProxyException` to handle every proxy-side error and
 * still let non-proxy errors propagate.
 */
class ProxyException extends IsaException
{
}
