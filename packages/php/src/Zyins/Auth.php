<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Credential for the ZyINS API. The ISA Platform recognizes three
 * dialects:
 *
 *  - `Authorization: Bearer isa_(live|test)_<secret>` — server-to-server.
 *  - `Authorization: License <b64(keycode:email)>` — agent tools
 *    (BPP web/desktop/online). Body HMAC follows in a downstream PR.
 *  - `Authorization: Session <sessionId>` — embedded forms. Body HMAC
 *    with the session secret follows in a downstream PR.
 *
 * The class refuses an empty token at construction; an unrecognized
 * prefix is permitted (forward-compatibility for future modes) and
 * surfaced via {@see Auth::isRecognizedPrefix()}.
 */
final readonly class Auth
{
    public const PREFIX_LIVE = 'isa_live_';
    public const PREFIX_TEST = 'isa_test_';

    public const SCHEME_BEARER = 'Bearer';
    public const SCHEME_LICENSE = 'License';
    public const SCHEME_SESSION = 'Session';

    public function __construct(
        public string $token,
        public string $scheme = self::SCHEME_BEARER,
    ) {
        if (trim($this->token) === '') {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth refuses an empty token');
        }
        // Reject control characters (incl. CR / LF / tab) anywhere in the
        // token — they would corrupt the Authorization header and have
        // historically been used in header-injection attacks.
        if (preg_match('/[\x00-\x1F\x7F]/', $this->token) === 1) {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth refuses a token containing control characters');
        }
    }

    /** Build a License-mode credential from the public/public tuple. */
    public static function license(string $keycode, string $email): self
    {
        if ($keycode === '') {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth::license requires a non-empty keycode');
        }
        if ($email === '') {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth::license requires a non-empty email');
        }
        $packed = base64_encode($keycode . ':' . $email);
        return new self(token: $packed, scheme: self::SCHEME_LICENSE);
    }

    /**
     * Build a Session-mode credential. The session secret is held by
     * the caller; the signing strategy that consumes it ships in a
     * follow-on PR.
     */
    public static function session(string $sid, string $sessionSecret): self
    {
        $sidIsEmpty = ($sid === '');
        $secretIsEmpty = ($sessionSecret === '');
        if ($sidIsEmpty) {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth::session requires a non-empty session id');
        }
        if ($secretIsEmpty) {
            throw new InvalidArgumentException('Sah\\Sdk\\Zyins\\Auth::session requires a non-empty session secret');
        }
        return new self(token: $sid, scheme: self::SCHEME_SESSION);
    }

    /**
     * Whether the token uses one of the documented bearer prefixes.
     * Useful for surfacing "did you paste the wrong key?" warnings.
     */
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
        return $this->scheme . ' ' . $this->token;
    }
}
