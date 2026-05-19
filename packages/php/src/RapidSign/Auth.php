<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign;

use Sah\Sdk\RapidSign\Exception\ValidationException;

/**
 * Bearer-token credential for the RapidSign API.
 *
 * The ISA Platform speaks one auth dialect on the public boundary:
 * `Authorization: Bearer isa_(live|test)_<secret>`. No HMAC at the SDK
 * layer (post-#286 contract). Empty and whitespace-only tokens are
 * rejected at construction; unrecognized prefixes are permitted
 * (forward-compatibility) but surfaceable via {@see isRecognizedPrefix()}.
 */
final readonly class Auth
{
    public const PREFIX_LIVE = 'isa_live_';
    public const PREFIX_TEST = 'isa_test_';

    public string $token;

    public function __construct(string $token)
    {
        $trimmed = trim($token);
        if ($trimmed === '') {
            throw new ValidationException(
                message: 'RapidSignClient: bearer token is required',
                param: 'token',
            );
        }
        $this->token = $trimmed;
    }

    public function isRecognizedPrefix(): bool
    {
        return str_starts_with($this->token, self::PREFIX_LIVE)
            || str_starts_with($this->token, self::PREFIX_TEST);
    }

    public function isLive(): bool
    {
        return str_starts_with($this->token, self::PREFIX_LIVE);
    }

    public function isTest(): bool
    {
        return str_starts_with($this->token, self::PREFIX_TEST);
    }

    public function authorizationHeader(): string
    {
        return 'Bearer ' . $this->token;
    }
}
