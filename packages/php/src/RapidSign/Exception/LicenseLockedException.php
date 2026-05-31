<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/** 423 — license is locked (admin action or too many devices). */
final class LicenseLockedException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 423, ?string $requestId = null, ?string $docUrl = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'license_locked',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
        );
    }
}
