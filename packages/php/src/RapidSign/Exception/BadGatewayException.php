<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/** 502 — upstream dependency returned an unusable response. Retryable. */
final class BadGatewayException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 502,
        ?string $requestId = null,
        ?int $retryAfterMs = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'bad_gateway',
            httpStatus: $httpStatus,
            requestId: $requestId,
            retryable: true,
            retryAfterMs: $retryAfterMs,
        );
    }
}
