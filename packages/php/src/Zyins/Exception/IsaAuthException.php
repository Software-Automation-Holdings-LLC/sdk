<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Exception;

/**
 * 401 / 403: the bearer token was missing, invalid, expired, or lacked
 * the scope required for this operation. Re-issue the token and retry;
 * a retry with the same token will fail the same way.
 */
final class IsaAuthException extends IsaException
{
}
