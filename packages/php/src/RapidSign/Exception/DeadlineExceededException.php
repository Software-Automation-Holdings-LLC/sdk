<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/**
 * Client-side deadline — polling or wait budget exhausted without success.
 * Distinct from server `gateway_timeout` (504).
 */
final class DeadlineExceededException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 408, ?string $requestId = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'deadline_exceeded',
            httpStatus: $httpStatus,
            requestId: $requestId,
        );
    }
}
