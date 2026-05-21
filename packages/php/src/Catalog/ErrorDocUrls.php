<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Doc URL per error code. Every value resolves to a live remediation
 * page on https://docs.isaapi.com.
 */
final class ErrorDocUrls
{
    /** @return array<string,string> */
    public static function all(): array
    {
        return [
            'bad_gateway' => 'https://docs.isaapi.com/errors/bad_gateway',
            'conflict' => 'https://docs.isaapi.com/errors/conflict',
            'forbidden' => 'https://docs.isaapi.com/errors/forbidden',
            'gateway_timeout' => 'https://docs.isaapi.com/errors/gateway_timeout',
            'internal_error' => 'https://docs.isaapi.com/errors/internal_error',
            'invalid_token' => 'https://docs.isaapi.com/errors/invalid_token',
            'license_locked' => 'https://docs.isaapi.com/errors/license_locked',
            'method_not_allowed' => 'https://docs.isaapi.com/errors/method_not_allowed',
            'not_found' => 'https://docs.isaapi.com/errors/not_found',
            'not_implemented' => 'https://docs.isaapi.com/errors/not_implemented',
            'rate_limit_exceeded' => 'https://docs.isaapi.com/errors/rate_limit_exceeded',
            'service_unavailable' => 'https://docs.isaapi.com/errors/service_unavailable',
            'token_expired' => 'https://docs.isaapi.com/errors/token_expired',
            'unauthorized' => 'https://docs.isaapi.com/errors/unauthorized',
            'validation_error' => 'https://docs.isaapi.com/errors/validation_error',
        ];
    }

    public static function for(ErrorCode $code): string
    {
        return self::all()[$code->value]
            ?? throw new \LogicException(sprintf('No doc URL registered for %s', $code->value));
    }
}
