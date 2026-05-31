<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/**
 * 429 rate limited. Always retryable.
 *
 * {@see retryAfterMs()} mirrors the `Retry-After` response header when
 * present (parsed to milliseconds). The header may be missing on
 * burst-control 429s; in that case the field stays null and the SDK
 * falls back to its own jittered backoff.
 *
 * The wire code may arrive as either `rate_limited` or
 * `rate_limit_exceeded`; we preserve whichever the server sent.
 */
final class RateLimitedException extends RapidSignException
{
    public function __construct(
        string $message,
        string $wireCode = 'rate_limit_exceeded',
        ?int $httpStatus = 429,
        ?string $requestId = null,
        ?int $retryAfterMs = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: $wireCode === 'rate_limited' ? 'rate_limited' : 'rate_limit_exceeded',
            httpStatus: $httpStatus,
            requestId: $requestId,
            retryable: true,
            retryAfterMs: $retryAfterMs,
        );
    }
}
