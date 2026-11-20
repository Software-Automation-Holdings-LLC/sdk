<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Logging;

use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;

/**
 * Optional debug logger that dumps HTTP request/response pairs the
 * SDK transport sees. Active only when one of:
 *
 *  - the `ZyInsClient` was constructed with a PSR-3 `LoggerInterface`,
 *  - or the `ISA_LOG=debug` environment variable is set, in which case
 *    the SDK falls back to a built-in stderr writer.
 *
 * The stderr writer NEVER writes to stdout — Anthropic's SDK has a
 * historical bug shipping debug output to stdout, breaking
 * parent/child JSON pipelines. We will not reproduce it.
 *
 * Redaction is unconditional and applies regardless of which logger is
 * installed:
 *
 *  - Headers `Authorization`, `X-Device-Signature`, `X-Session-Signature`,
 *    `X-Isa-Signature`, `Cookie`, `Set-Cookie` → "[redacted]".
 *  - Bodies are never written. Each is summarized as its byte length
 *    plus the top-level envelope fields the server assigns (`object`,
 *    `request_id`, `idempotency_key`, `code`, `param`).
 *
 * Bodies carry the applicant's underwriting record (birth date, build,
 * location, conditions, medications) under wire names that change with
 * every API version, so the summary names what may be kept rather than
 * what must be hidden: a field nobody listed is withheld, not leaked.
 */
final class DebugLogger
{
    public const ENV_VAR = 'ISA_LOG';
    public const ENV_VALUE = 'debug';

    private const REDACTED = '[redacted]';

    /** @var array<int,string> Header names compared case-insensitively. */
    private const REDACTED_HEADERS = [
        'authorization',
        'x-device-signature',
        'x-session-signature',
        'x-isa-signature',
        'cookie',
        'set-cookie',
    ];

    /** @var array<int,string> Server-assigned envelope fields; every other body value is withheld. */
    private const ENVELOPE_FIELDS = [
        'object',
        'request_id',
        'idempotency_key',
        'code',
        'param',
    ];

    public function __construct(private readonly ?LoggerInterface $logger = null)
    {
    }

    /**
     * Whether the user has opted into debug logging — either by passing
     * a PSR-3 logger or by setting `ISA_LOG=debug` in the environment.
     */
    public function isEnabled(): bool
    {
        if ($this->logger !== null) {
            return true;
        }
        $env = getenv(self::ENV_VAR);
        return is_string($env) && strtolower($env) === self::ENV_VALUE;
    }

    /**
     * Log an outbound request. `attempt` is zero on the first try and
     * non-zero for SDK-driven retries.
     */
    public function logRequest(RequestInterface $request, int $attempt = 0): void
    {
        if (! $this->isEnabled()) {
            return;
        }
        $payload = [
            'direction' => 'request',
            'method' => $request->getMethod(),
            'uri' => (string) $request->getUri(),
            'attempt' => $attempt,
            'headers' => self::redactHeaders($request->getHeaders()),
            'body' => self::summarizeBody((string) $request->getBody()),
        ];
        $this->emit('isa-sdk request', $payload);
    }

    public function logResponse(ResponseInterface $response, RequestInterface $request, int $attempt = 0): void
    {
        if (! $this->isEnabled()) {
            return;
        }
        $payload = [
            'direction' => 'response',
            'method' => $request->getMethod(),
            'uri' => (string) $request->getUri(),
            'status' => $response->getStatusCode(),
            'attempt' => $attempt,
            'headers' => self::redactHeaders($response->getHeaders()),
            'body' => self::summarizeBody((string) $response->getBody()),
        ];
        $this->emit('isa-sdk response', $payload);
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function emit(string $message, array $payload): void
    {
        if ($this->logger !== null) {
            $this->logger->debug($message, $payload);
            return;
        }
        $line = $message . ' ' . json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        $stderr = fopen('php://stderr', 'w');
        if ($stderr === false) {
            return;
        }
        fwrite($stderr, $line . PHP_EOL);
        fclose($stderr);
    }

    /**
     * @param array<string,array<int,string>> $headers
     * @return array<string,array<int,string>>
     */
    private static function redactHeaders(array $headers): array
    {
        $out = [];
        foreach ($headers as $name => $values) {
            if (in_array(strtolower($name), self::REDACTED_HEADERS, true)) {
                $out[$name] = [self::REDACTED];
                continue;
            }
            $out[$name] = $values;
        }
        return $out;
    }

    /**
     * Only scalar envelope values survive: an envelope name holding an
     * object or list is withheld like any other body value.
     *
     * @return array<string,int|string|bool>
     */
    private static function summarizeBody(string $raw): array
    {
        $summary = ['bytes' => strlen($raw)];
        $envelope = self::decodeObject($raw);
        foreach (self::ENVELOPE_FIELDS as $field) {
            $value = $envelope[$field] ?? null;
            if (is_string($value) || is_int($value) || is_bool($value)) {
                $summary[$field] = $value;
            }
        }
        return $summary;
    }

    /**
     * @return array<mixed>
     */
    private static function decodeObject(string $raw): array
    {
        try {
            $decoded = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }
        return is_array($decoded) ? $decoded : [];
    }
}
