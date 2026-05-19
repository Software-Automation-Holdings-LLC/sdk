<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Logging;

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
 *  - JSON body fields named `email`, `dob`, `ssn`, `phone`, `password`,
 *    `token`, `secret` → "[redacted]" (recursive, case-insensitive).
 *
 * The logger is the only diagnostic surface that can see decoded
 * bodies, so redaction lives here, never in the transport.
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

    /** @var array<int,string> Body field names compared case-insensitively. */
    private const REDACTED_BODY_FIELDS = [
        'email',
        'dob',
        'ssn',
        'phone',
        'password',
        'token',
        'secret',
        'session_secret',
        'license_key',
        'keycode',
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
            'body' => self::redactBody((string) $request->getBody()),
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
            'body' => self::redactBody((string) $response->getBody()),
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
     * Best-effort redaction of a JSON body. Non-JSON bodies pass through
     * unchanged (the redaction targets are PII fields that only appear
     * in structured payloads).
     */
    private static function redactBody(string $raw): mixed
    {
        if ($raw === '') {
            return '';
        }
        $trimmed = ltrim($raw);
        if ($trimmed === '' || ($trimmed[0] !== '{' && $trimmed[0] !== '[')) {
            return $raw;
        }
        try {
            $decoded = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return $raw;
        }
        if (! is_array($decoded)) {
            return $raw;
        }
        return self::redactArray($decoded);
    }

    /**
     * @param array<mixed> $data
     * @return array<mixed>
     */
    private static function redactArray(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::REDACTED_BODY_FIELDS, true)) {
                $data[$key] = self::REDACTED;
                continue;
            }
            if (is_array($value)) {
                $data[$key] = self::redactArray($value);
            }
        }
        return $data;
    }
}
