<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/** 504 — upstream dependency did not respond. Retryable. */
final class GatewayTimeoutException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 504,
        ?string $requestId = null,
        ?int $retryAfterMs = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'gateway_timeout',
            httpStatus: $httpStatus,
            requestId: $requestId,
            retryable: true,
            retryAfterMs: $retryAfterMs,
        );
    }
}
