<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/** 500 — unhandled server fault. Retryable. */
final class InternalErrorException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 500,
        ?string $requestId = null,
        ?int $retryAfterMs = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'internal_error',
            httpStatus: $httpStatus,
            requestId: $requestId,
            retryable: true,
            retryAfterMs: $retryAfterMs,
        );
    }
}
