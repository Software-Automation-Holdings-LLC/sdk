<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/** 503 — service is intentionally unavailable. Retryable. */
final class ServiceUnavailableException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 503,
        ?string $requestId = null,
        ?int $retryAfterMs = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'service_unavailable',
            httpStatus: $httpStatus,
            requestId: $requestId,
            retryable: true,
            retryAfterMs: $retryAfterMs,
        );
    }
}
