<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Exception;

/**
 * 429 rate limited from the proxy.
 *
 * {@see retryAfterSeconds()} mirrors the `Retry-After` response header
 * when present. The header may be missing on burst-control 429s; the
 * SDK leaves the field null in that case rather than guessing.
 */
final class ProxyRateLimitException extends ProxyException
{
    public function __construct(
        string $message,
        ?int $httpStatus = null,
        ?string $requestId = null,
        private readonly ?int $retryAfterSeconds = null,
        ?string $docUrl = null,
        ?string $adviceCode = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'rate_limited',
            httpStatus: $httpStatus,
            requestId: $requestId,
            adviceCode: $adviceCode,
            docUrl: $docUrl,
        );
    }

    public function retryAfterSeconds(): ?int
    {
        return $this->retryAfterSeconds;
    }
}
