<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/**
 * 501 — capability not yet implemented (e.g. `cancel`, webhooks).
 *
 * Today this also funnels client-side stub paths: the SDK surface
 * includes methods whose server endpoints have not yet landed. Those
 * methods throw `NotImplementedException` with an appropriate message.
 */
final class NotImplementedException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 501, ?string $requestId = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'not_implemented',
            httpStatus: $httpStatus,
            requestId: $requestId,
        );
    }
}
