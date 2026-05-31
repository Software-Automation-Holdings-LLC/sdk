<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Machine-readable next-action identifiers keyed by wire-form error
 * code. A programmatic consumer switches on these values to choose a
 * retry / refresh / surface-to-user strategy.
 */
final class ErrorAdviceCodes
{
    /** @return array<string,string> */
    public static function all(): array
    {
        return [
            'bad_gateway' => 'retry_with_backoff',
            'conflict' => 'reconcile_state',
            'forbidden' => 'check_scopes',
            'gateway_timeout' => 'retry_with_backoff',
            'internal_error' => 'retry_or_contact_support',
            'invalid_token' => 'reissue_session',
            'license_locked' => 'contact_support',
            'method_not_allowed' => 'check_http_method',
            'not_found' => 'verify_resource_id',
            'not_implemented' => 'check_feature_availability',
            'rate_limit_exceeded' => 'wait_and_retry',
            'service_unavailable' => 'retry_with_backoff',
            'token_expired' => 'refresh_session',
            'unauthorized' => 'authenticate_caller',
            'validation_error' => 'fix_request_body',
        ];
    }

    public static function for(ErrorCode $code): string
    {
        return self::all()[$code->value]
            ?? throw new \LogicException(sprintf('No advice code registered for %s', $code->value));
    }
}
