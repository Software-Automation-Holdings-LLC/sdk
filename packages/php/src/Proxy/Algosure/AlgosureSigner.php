<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Algosure;

use Sah\Sdk\Proxy\Clock;
use Sah\Sdk\Proxy\Exception\AlgosureException;
use Sah\Sdk\Proxy\SystemClock;

/**
 * Algosure HMAC signer — embedded-salt variant (post-PR #512 protocol).
 *
 * Ports the canonical algorithm from `@isa-sdk/proxy/algosure/embedded`
 * (JS) and `github.com/Software-Automation-Holdings-LLC/sdk/proxy/algosure`
 * (Go). Cross-language parity is locked by
 * `shared/schemas/sdk/testdata/algosure_vectors.json`; the PHP package
 * ships a mirror of that file and asserts byte-equality in
 * `tests/Algosure/VectorParityTest.php`.
 *
 * Patent: IIP-0016-WO ("Methods and System to Authenticate Client-Side
 * Transmission Access") — CIP pending for the HMAC variant.
 */
final readonly class AlgosureSigner
{
    private const JSON_ENCODE_FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /** 30-second buckets for clock-skew tolerance. Must match server. */
    public const TIME_BUCKET_MS = 30_000;

    /** Floor of the derived simple-key length, matching JS and Go. */
    public const MIN_SIMPLE_KEY_LEN = 8;

    public function __construct(
        private Clock $clock = new SystemClock(),
    ) {
    }

    /**
     * Computes the HMAC tag for an Algosure-authenticated request.
     *
     * @return array{0: string, 1: int} Tuple of [hexTag, timestampMs].
     */
    public function computeHmac(AlgosureInput $input): array
    {
        self::normalizeSaltIdHeader($input->saltId);
        if ($input->salt === '') {
            throw new AlgosureException(
                'Algosure: missing embedded salt (form.metadata._algosure_salt). Republish the form to pick up the salt embed.',
            );
        }
        $timestamp = $input->timestampMs ?? $this->clock->nowMillis();
        $simpleKey = self::deriveSimpleKey($input->salt, $timestamp);
        $bodyStr = self::serializeBody($input->body);
        $bodyHash = hash('sha256', $bodyStr);

        // Null-delimited canonical string, matching server-side verifier order.
        $canonical = implode("\x00", [
            $input->method,
            $input->path,
            $bodyHash,
            (string) $timestamp,
            $input->sessionId,
        ]);
        $tag = hash_hmac('sha256', $canonical, $simpleKey);
        return [$tag, $timestamp];
    }

    /**
     * Builds the full Algosure header bag. The emitted `*SaltId` tells
     * the verifier which proxy_salts row the form was built against,
     * decoupling salt rotation from deployed-form lifetime.
     *
     * @return array<string,string>
     */
    public function buildHeaders(AlgosureInput $input): array
    {
        $saltIdHeader = self::normalizeSaltIdHeader($input->saltId);
        [$tag, $timestamp] = $this->computeHmac($input);
        return [
            'Authorization' => $tag,
            '*Host' => $input->host,
            '*Timestamp' => (string) $timestamp,
            '*sessionId' => $input->sessionId,
            '*SaltId' => $saltIdHeader,
        ];
    }

    /**
     * Derives a simple key from the salt content using a time-bucketed
     * index. Must match the server-side derivation in
     * `auth/algosure/algosure.go` and the JS `deriveSimpleKey`.
     *
     * Exposed for unit tests and parity checks; callers should prefer
     * {@see computeHmac()} / {@see buildHeaders()}.
     */
    public static function deriveSimpleKey(string $salt, int $timestampMs): string
    {
        $len = strlen($salt);
        if ($len === 0) {
            return '';
        }
        $bucket = intdiv($timestampMs, self::TIME_BUCKET_MS);
        $digitSum = self::digitSumOf($bucket);
        $keyLen = max(self::MIN_SIMPLE_KEY_LEN, $digitSum);
        $start = (($bucket % $len) + $len) % $len;

        $key = '';
        for ($i = 0; $i < $keyLen; $i++) {
            $key .= $salt[($start + $i) % $len];
        }
        return $key;
    }

    /**
     * Returns true when `saltId` round-trips cleanly to the proxy
     * verifier's positive-integer parse. Rejecting here surfaces a
     * malformed embed at the signer rather than as an opaque 4xx
     * downstream.
     */
    public static function isSaltIdValid(int|string $saltId): bool
    {
        if (is_int($saltId)) {
            return $saltId > 0;
        }
        return $saltId !== '' && preg_match('/^[1-9][0-9]*$/', $saltId) === 1;
    }

    private static function normalizeSaltIdHeader(int|string $saltId): string
    {
        if (! self::isSaltIdValid($saltId)) {
            throw new AlgosureException(
                'Algosure: missing or malformed embedded salt id (form.metadata._algosure_salt_id). Republish the form to pick up the salt embed.',
            );
        }
        return (string) $saltId;
    }

    private static function serializeBody(mixed $body): string
    {
        if ($body === null) {
            return '';
        }
        if (is_string($body)) {
            return $body;
        }
        try {
            return json_encode($body, self::JSON_ENCODE_FLAGS);
        } catch (\JsonException $e) {
            throw new AlgosureException(
                'Algosure: request body is not JSON-serializable: ' . $e->getMessage(),
                previous: $e,
            );
        }
    }

    /**
     * Returns the decimal digit sum of $n, or 1 when $n has no digits,
     * so callers never receive a zero-length key.
     */
    private static function digitSumOf(int $n): int
    {
        if ($n < 0) {
            $n = -$n;
        }
        $sum = 0;
        while ($n > 0) {
            $sum += $n % 10;
            $n = intdiv($n, 10);
        }
        return $sum === 0 ? 1 : $sum;
    }
}
