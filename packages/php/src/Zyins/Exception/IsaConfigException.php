<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Exception;

use Throwable;

/**
 * Thrown when a factory cannot resolve required configuration —
 * typically a missing environment variable when constructing the
 * client via {@see \Isa\Sdk\Zyins\ZyInsClient::withBearer()} or a
 * sibling factory.
 *
 * Carries a fixed `configuration_error` code so consumers can switch
 * on the failure shape without parsing English messages.
 */
final class IsaConfigException extends IsaException
{
    public const CODE = 'configuration_error';

    public function __construct(string $message, ?Throwable $previous = null)
    {
        parent::__construct(
            message: $message,
            errorCode: self::CODE,
            previous: $previous,
        );
    }
}
