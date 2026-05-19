<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

use Throwable;

/** 401 — missing or invalid bearer token. */
final class UnauthorizedException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 401,
        ?string $requestId = null,
        ?string $docUrl = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'unauthorized',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
            previous: $previous,
        );
    }
}
