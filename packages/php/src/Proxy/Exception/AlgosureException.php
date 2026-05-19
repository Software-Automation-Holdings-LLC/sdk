<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Exception;

/**
 * Algosure header-construction failure. Distinct from `ProxyException`
 * because it surfaces BEFORE any HTTP call — empty salt, malformed
 * salt id, missing session id — so callers can fail fast without
 * round-tripping the proxy.
 */
final class AlgosureException extends IsaException
{
    public function __construct(string $message, ?\Throwable $previous = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'algosure_error',
            previous: $previous,
        );
    }
}
