<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Canonical session-signing helper.
 *
 * Emits the four headers the ISA Platform session verifier requires:
 *
 *   Authorization:    Bearer <sessionSecret>
 *   X-Isa-Session-Id: <sessionId>
 *   X-Isa-Timestamp:  <iso8601_z>
 *   X-Isa-Signature:  hex(HMAC-SHA256(sessionSecret, canonical))
 *
 * The canonical string is byte-identical to `session.CanonicalString`
 * in `shared/go/auth/session/canonical.go`:
 *
 *   <METHOD>\n<path>\n<hex(sha256(body))>\n<timestamp>\n<sessionId>
 *
 * No trailing newline.
 */
final class SignRequest
{
    private const EMPTY_SHA256 =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    /**
     * Build the canonical signing string. Pure function; exported for
     * test parity with the Go / TS / Python / C# implementations.
     */
    public static function canonicalString(
        string $method,
        string $path,
        string $body,
        string $timestamp,
        string $sessionId
    ): string {
        $bodyHashHex = strlen($body) === 0
            ? self::EMPTY_SHA256
            : hash('sha256', $body);

        return implode("\n", [
            strtoupper($method),
            $path,
            $bodyHashHex,
            $timestamp,
            $sessionId,
        ]);
    }

    /**
     * Format an instant as RFC 3339 UTC with a `Z` suffix and no
     * fractional seconds. Matches Go's `time.RFC3339` rendering.
     */
    public static function formatTimestamp(DateTimeInterface $now): string
    {
        $utc = DateTimeImmutable::createFromInterface($now)
            ->setTimezone(new DateTimeZone('UTC'));

        return $utc->format('Y-m-d\TH:i:s\Z');
    }

    /**
     * Compute the canonical session-auth headers for a single request.
     *
     * @return array{
     *     Authorization: string,
     *     'X-Isa-Session-Id': string,
     *     'X-Isa-Timestamp': string,
     *     'X-Isa-Signature': string
     * }
     *
     * @throws InvalidArgumentException if sessionId / sessionSecret is empty.
     */
    public static function sign(
        string $method,
        string $path,
        string $body,
        string $sessionId,
        string $sessionSecret,
        ?DateTimeInterface $now = null
    ): array {
        if (strlen($sessionId) === 0) {
            throw new InvalidArgumentException(
                'SignRequest: sessionId must be a non-empty string'
            );
        }
        if (strlen($sessionSecret) === 0) {
            throw new InvalidArgumentException(
                'SignRequest: sessionSecret must be a non-empty string'
            );
        }

        $timestamp = self::formatTimestamp(
            $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'))
        );
        $canonical = self::canonicalString(
            $method,
            $path,
            $body,
            $timestamp,
            $sessionId
        );
        $signature = hash_hmac('sha256', $canonical, $sessionSecret);

        return [
            'Authorization' => 'Bearer ' . $sessionSecret,
            'X-Isa-Session-Id' => $sessionId,
            'X-Isa-Timestamp' => $timestamp,
            'X-Isa-Signature' => $signature,
        ];
    }
}
