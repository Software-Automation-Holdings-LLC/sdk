<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/** 409 — state conflict (already signed, already cancelled, etc.). */
final class ConflictException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 409, ?string $requestId = null, ?string $docUrl = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'conflict',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
        );
    }
}
