<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

use InvalidArgumentException;

/**
 * Bearer-token credential for the proxy API.
 *
 * The proxy's public boundary speaks one dialect: `Authorization:
 * Bearer isa_(live|test)_<secret>`. HMAC lives at the proxy↔downstream
 * hop (Algosure), not at the SDK↔proxy hop.
 *
 * The class refuses an empty token at construction; an unrecognized
 * prefix is permitted (forward-compatibility for future modes like
 * `isa_session_...`) but flagged via {@see isRecognizedPrefix()} so
 * consumer code can warn before sending.
 */
final readonly class Auth
{
    public const PREFIX_LIVE = 'isa_live_';
    public const PREFIX_TEST = 'isa_test_';

    public function __construct(public string $token)
    {
        if (trim($this->token) === '' || preg_match('/[\x00-\x1F\x7F]/', $this->token) === 1) {
            throw new InvalidArgumentException('Sah\\IsaSdk\\Proxy\\Auth refuses an empty or control-character token');
        }
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
