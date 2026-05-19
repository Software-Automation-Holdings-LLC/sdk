<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

use Throwable;

/** Fallback for malformed bodies, network anomalies, and unrecognized wire codes. */
final class UnknownException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = null,
        ?string $requestId = null,
        ?string $wireCode = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: ($wireCode !== null && trim($wireCode) !== '') ? $wireCode : 'unknown',
            httpStatus: $httpStatus,
            requestId: $requestId,
            previous: $previous,
        );
    }
}
