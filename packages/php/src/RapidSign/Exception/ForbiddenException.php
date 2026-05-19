<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/** 403 — authenticated but lacking the scope for this operation. */
final class ForbiddenException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 403, ?string $requestId = null, ?string $docUrl = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'forbidden',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
        );
    }
}
