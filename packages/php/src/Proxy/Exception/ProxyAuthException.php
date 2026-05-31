<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy\Exception;

/**
 * 401 / 403 from the proxy: the bearer token was missing, invalid,
 * expired, or lacked the scope required for this operation (e.g., the
 * caller does not own the integration). Re-issue the token and retry;
 * a retry with the same token will fail the same way.
 */
final class ProxyAuthException extends ProxyException
{
}
