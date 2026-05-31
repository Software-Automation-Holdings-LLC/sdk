<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Exception;

/**
 * 429 rate limited.
 *
 * {@see retryAfterSeconds()} mirrors the `Retry-After` response header
 * when present. The header may be missing on burst-control 429s; the
 * SDK leaves the field null in that case rather than guessing.
 */
final class IsaRateLimitException extends IsaException
{
    public function __construct(
        string $message,
        ?int $httpStatus = null,
        ?string $requestId = null,
        private readonly ?int $retryAfterSeconds = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'rate_limited',
            httpStatus: $httpStatus,
            requestId: $requestId,
        );
    }

    public function retryAfterSeconds(): ?int
    {
        return $this->retryAfterSeconds;
    }
}
