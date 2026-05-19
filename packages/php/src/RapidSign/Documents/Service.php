<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

use DateTimeImmutable;
use Psr\Http\Message\ResponseInterface;
use Sah\Sdk\RapidSign\Clock;
use Sah\Sdk\RapidSign\Exception\DeadlineExceededException;
use Sah\Sdk\RapidSign\Exception\NotFoundException;
use Sah\Sdk\RapidSign\Exception\NotImplementedException;
use Sah\Sdk\RapidSign\Exception\RapidSignException;
use Sah\Sdk\RapidSign\Exception\UnknownException;
use Sah\Sdk\RapidSign\Exception\ValidationException;
use Sah\Sdk\RapidSign\Internal\Duration;
use Sah\Sdk\RapidSign\Internal\HttpTransport;

/**
 * RapidSign documents service.
 *
 * Five public methods on the SDK surface:
 *
 *   - `send`            — create + notify (one logical op; two server calls today)
 *   - `get`             — read current state
 *   - `awaitSignature`  — poll until signed or timeout
 *   - `download`        — fetch the signed PDF (transparently decompressed)
 *   - `cancel`          — cancel a pending envelope (server endpoint pending, #38)
 *
 * Two of these methods are "shape leads server": `send` collapses a
 * CreateDocument + NotifyDocument pair the proto exposes separately, and
 * `cancel` throws {@see NotImplementedException} until the matching
 * server endpoint ships. The SDK surface is the product.
 */
final readonly class Service
{
    private const PATH_DOCUMENTS = '/v1/documents';

    private const POLL_BASE_MS = 2_000;
    private const POLL_MAX_MS = 30_000;
    private const POLL_JITTER = 0.25;
    private const DEFAULT_AWAIT_TIMEOUT_MS = 24 * 60 * 60 * 1_000;
    private const BACKOFF_BASE_MS = 500;
    private const BACKOFF_MAX_MS = 8_000;

    private const NOT_IMPLEMENTED_DETAIL = 'the RapidSign server endpoint is not yet shipped';

    public function __construct(
        private HttpTransport $transport,
        private Clock $clock,
    ) {
    }

    /**
     * Send a packet to a recipient. Issues a CreateDocument then
     * NotifyDocument; both fail-safely (a failed notify after a
     * successful create surfaces as the underlying error, leaving the
     * packet retrievable by sign id for a retry).
     */
    public function send(SendRequest $request): Envelope
    {
        $this->validateSendRequest($request);
        $sessionId = $this->transport->idempotency->next();
        $signId = $this->transport->idempotency->next();
        $idempotencyKey = $request->idempotencyKey ?? $this->transport->idempotency->next();

        $createBody = $this->buildCreateBody($request, $sessionId, $signId);
        /** @var array<string,mixed> $created */
        $created = $this->callJson('POST', self::PATH_DOCUMENTS, $createBody, $idempotencyKey);
        $resolvedSignId = $this->extractSignId($created, $signId);

        $notifyBody = [
            'sign_id' => $resolvedSignId,
            'session_id' => $sessionId,
            'to' => $request->recipient->email,
        ];
        if ($request->notificationKey !== null) {
            $notifyBody['key'] = $request->notificationKey;
        }
        $this->callJson(
            'POST',
            self::PATH_DOCUMENTS . '/' . rawurlencode($resolvedSignId) . '/notify',
            $notifyBody,
            $this->transport->idempotency->next(),
        );

        return $this->assembleEnvelope($request, $resolvedSignId, $created);
    }

    /**
     * Fetch current state for a signed-or-pending envelope. Returns a
     * {@see Signature} when the document has been signed; throws
     * {@see NotFoundException} when the sign id is unknown or no
     * signature has been captured yet.
     */
    public function get(string $signId, ?string $sessionId = null, ?int $deadlineMs = null): Signature
    {
        $this->requireSignId($signId);
        $path = self::PATH_DOCUMENTS . '/' . rawurlencode($signId);
        $query = $this->querystring(['session_id' => $sessionId]);
        $url = $this->transport->baseUrl . $path . $query;

        $attempt = 0;
        while (true) {
            $response = $this->transport->send('GET', $url, [], '');
            if ($this->isSuccess($response)) {
                return $this->parseSignature((string) $response->getBody());
            }
            $err = HttpTransport::exceptionFor($response);
            if (! $err->retryable() || $attempt >= $this->transport->maxRetries) {
                throw $err;
            }
            $this->transport->sleeper->sleepMs(
                $this->retrySleepMs($err->retryAfterMs() ?? $this->backoffMs($attempt), $deadlineMs),
            );
            $attempt++;
        }
    }

    /**
     * Poll `get` on a jittered exponential backoff until the document is
     * signed or the timeout elapses.
     *
     * On the first `get` 404, probes `download` once: per proto, download
     * 404 means no document was stored for the sign id (invalid id),
     * while get 404 alone means the signature is not captured yet.
     */
    public function awaitSignature(string $signId, ?AwaitOpts $opts = null): Signature
    {
        $this->requireSignId($signId);
        $timeoutMs = $this->clampTimeout($opts?->timeout);
        $start = $this->clock->nowMs();
        $attempt = 0;
        $probedDocumentStore = false;
        while (true) {
            try {
                return $this->get($signId, null, $start + $timeoutMs);
            } catch (NotFoundException $err) {
                if (! $probedDocumentStore) {
                    $probeResult = $this->probeStoredDocumentSafely($signId);
                    $probedDocumentStore = $probeResult !== null;
                    if ($probeResult === false) {
                        throw new NotFoundException(
                            message: 'awaitSignature: no document stored for sign id ' . $signId,
                            requestId: $err->requestId(),
                        );
                    }
                }
            } catch (RapidSignException $err) {
                if (! $err->retryable()) {
                    throw $err;
                }
            }
            $elapsed = $this->clock->nowMs() - $start;
            $remaining = $timeoutMs - $elapsed;
            if ($remaining <= 0) {
                throw new DeadlineExceededException(
                    message: sprintf('awaitSignature: timed out after %dms waiting for %s', $timeoutMs, $signId),
                );
            }
            $delay = min($remaining, $this->nextPollDelayMs($attempt));
            $this->transport->sleeper->sleepMs($delay);
            $attempt++;
        }
    }

    /**
     * Download the signed PDF as a binary string. The wire response is
     * gzip + base64; decompression is transparent. Throws
     * {@see NotFoundException} if the sign id is unknown.
     */
    public function download(string $signId, ?string $sessionId = null): string
    {
        $this->requireSignId($signId);
        $path = self::PATH_DOCUMENTS . '/' . rawurlencode($signId) . '/download';
        $url = $this->transport->baseUrl . $path . $this->querystring(['session_id' => $sessionId]);

        $attempt = 0;
        while (true) {
            $response = $this->transport->send('GET', $url, [], '');
            if ($this->isSuccess($response)) {
                return $this->decodeDownload((string) $response->getBody(), $response);
            }
            $err = HttpTransport::exceptionFor($response);
            if (! $err->retryable() || $attempt >= $this->transport->maxRetries) {
                throw $err;
            }
            $this->transport->sleeper->sleepMs($this->retrySleepMs($err->retryAfterMs() ?? $this->backoffMs($attempt), null));
            $attempt++;
        }
    }

    /**
     * Cancel a pending envelope.
     *
     * The matching server endpoint is not yet implemented (tracked at
     * the issue URL embedded in the thrown error). The SDK surface lands
     * here so the cross-language contract is final; flipping the error
     * to a real call is a one-line change once the server lands.
     */
    public function cancel(string $signId, CancelRequest $request): void
    {
        $this->requireSignId($signId);
        if ($request->reason === '') {
            throw new ValidationException(
                message: 'cancel: request.reason is required',
                param: 'reason',
            );
        }
        throw new NotImplementedException(
            message: 'documents.cancel is not yet implemented on the server (' . self::NOT_IMPLEMENTED_DETAIL . ')',
        );
    }

    /* ---------- helpers ---------- */

    private function validateSendRequest(SendRequest $request): void
    {
        if ($request->packet === []) {
            throw new ValidationException(
                message: 'send: packet must be a non-empty array',
                param: 'packet',
            );
        }
        foreach ($request->packet as $i => $source) {
            if (! $source instanceof PdfSource) {
                throw new ValidationException(
                    message: sprintf('send: packet[%d] must be a PdfSource', $i),
                    param: sprintf('packet[%d]', $i),
                );
            }
            if ($source->url === '') {
                throw new ValidationException(
                    message: sprintf('send: packet[%d].url is required', $i),
                    param: sprintf('packet[%d].url', $i),
                );
            }
        }
        if ($request->recipient->email === '') {
            throw new ValidationException(
                message: 'send: recipient.email is required',
                param: 'recipient.email',
            );
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function buildCreateBody(SendRequest $request, string $sessionId, string $signId): array
    {
        $packet = [];
        foreach ($request->packet as $p) {
            $entry = ['url' => $p->url];
            if ($p->expectedHash !== null) {
                $entry['expected_hash'] = $p->expectedHash;
            }
            $packet[] = $entry;
        }
        $body = [
            'session_id' => $sessionId,
            'packet' => $packet,
            'sign_ids' => [$signId],
            'remote_allowed' => true,
            'is_production' => true,
        ];
        if ($request->legalText !== null) {
            $body['binding_legal_text'] = $request->legalText;
        }
        if ($request->metadata !== []) {
            $body['metadata'] = $request->metadata;
        }
        if ($request->expiresIn !== null) {
            $body['ttl'] = $this->normalizeTtl($request->expiresIn);
        }
        return $body;
    }

    private function normalizeTtl(string|int $value): string
    {
        if (is_string($value) && Duration::isIso8601($value)) {
            return strtoupper(trim($value));
        }
        $ms = Duration::parse($value);
        if ($ms % 1_000 !== 0) {
            throw new ValidationException(
                message: 'send: expiresIn must resolve to whole seconds',
                param: 'expiresIn',
            );
        }
        return 'PT' . intdiv($ms, 1_000) . 'S';
    }

    /**
     * @param array<string,mixed> $created
     */
    private function extractSignId(array $created, string $clientSignId): string
    {
        $signIds = $created['sign_ids'] ?? null;
        if (is_array($signIds) && isset($signIds[0]) && is_string($signIds[0]) && $signIds[0] !== '') {
            return $signIds[0];
        }
        $signId = $created['sign_id'] ?? null;
        if (is_string($signId) && $signId !== '') {
            return $signId;
        }
        return $clientSignId;
    }

    /**
     * @param array<string,mixed> $created
     */
    private function assembleEnvelope(SendRequest $request, string $signId, array $created): Envelope
    {
        $id = $created['document_id'] ?? null;
        if (! is_string($id) || $id === '') {
            throw new UnknownException(
                message: 'send: server response did not include document_id',
            );
        }
        $createdAt = $this->parseTimestamp($created['created_at'] ?? null)
            ?? (new DateTimeImmutable())->setTimestamp(intdiv($this->clock->nowMs(), 1_000));
        $expiresAt = $this->parseTimestamp($created['expires_at'] ?? null) ?? $this->defaultExpiresAt($request);
        $hashes = [];
        if (isset($created['hashes']) && is_array($created['hashes'])) {
            foreach ($created['hashes'] as $k => $v) {
                if (is_string($k) && is_string($v)) {
                    $hashes[$k] = $v;
                }
            }
        }
        return new Envelope(
            id: $id,
            signId: $signId,
            signUrl: is_string($created['sign_url'] ?? null) ? $created['sign_url'] : '',
            viewUrl: is_string($created['view_url'] ?? null) ? $created['view_url'] : '',
            status: EnvelopeStatus::Notified,
            recipient: $request->recipient,
            hashes: $hashes,
            createdAt: $createdAt,
            expiresAt: $expiresAt,
            metadata: $request->metadata,
        );
    }

    private function defaultExpiresAt(SendRequest $request): DateTimeImmutable
    {
        $nowMs = $this->clock->nowMs();
        $ttlMs = $request->expiresIn !== null
            ? Duration::parse($request->expiresIn)
            : 30 * Duration::DAY_MS;
        return (new DateTimeImmutable())->setTimestamp(intdiv($nowMs + $ttlMs, 1_000));
    }

    private function parseTimestamp(mixed $value): ?DateTimeImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }
        try {
            return new DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }

    private function parseSignature(string $body): Signature
    {
        $parsed = $this->safeJsonDecode($body);
        if ($parsed === null || ! isset($parsed['signature']) || ! is_string($parsed['signature'])) {
            throw new UnknownException(
                message: 'get: server returned a 200 with an unparseable body',
                httpStatus: 200,
            );
        }
        $sigBytes = base64_decode($parsed['signature'], strict: true);
        if ($sigBytes === false) {
            throw new UnknownException(
                message: 'get: server returned an invalid base64 signature payload',
                httpStatus: 200,
            );
        }
        $timestamp = $parsed['timestamp'] ?? null;
        $signedAtMs = is_int($timestamp) || is_float($timestamp)
            ? (int) ($timestamp * 1_000)
            : $this->clock->nowMs();
        $metadata = $this->coerceMetadata($parsed['user_metadata'] ?? null);
        return new Signature(
            signId: is_string($parsed['sign_id'] ?? null) ? $parsed['sign_id'] : '',
            signature: $sigBytes,
            signedAt: (new DateTimeImmutable())->setTimestamp(intdiv($signedAtMs, 1_000)),
            signerIp: is_string($parsed['signer_ip'] ?? null) ? $parsed['signer_ip'] : ($metadata['ip'] ?? ''),
            userAgent: is_string($parsed['user_agent'] ?? null) ? $parsed['user_agent'] : ($metadata['user_agent'] ?? ''),
            metadata: $metadata,
        );
    }

    /**
     * @return array<string,string>
     */
    private function coerceMetadata(mixed $raw): array
    {
        if ($raw === null) {
            return [];
        }
        if (is_string($raw)) {
            $parsed = $this->safeJsonDecode($raw);
            return $parsed !== null ? $this->stringifyEntries($parsed) : [];
        }
        if (is_array($raw)) {
            return $this->stringifyEntries($raw);
        }
        return [];
    }

    /**
     * @param array<int|string,mixed> $obj
     * @return array<string,string>
     */
    private function stringifyEntries(array $obj): array
    {
        $out = [];
        foreach ($obj as $k => $v) {
            if (! is_string($k)) {
                continue;
            }
            if (is_string($v)) {
                $out[$k] = $v;
            } elseif (is_int($v) || is_float($v) || is_bool($v)) {
                $out[$k] = is_bool($v) ? ($v ? 'true' : 'false') : (string) $v;
            }
        }
        return $out;
    }

    private function decodeDownload(string $body, ResponseInterface $response): string
    {
        $parsed = $this->safeJsonDecode($body);
        if ($parsed === null || ! isset($parsed['pdf_gzip_base64']) || ! is_string($parsed['pdf_gzip_base64'])) {
            $requestId = $response->getHeaderLine('x-request-id');
            throw new UnknownException(
                message: 'download: server returned a 200 with an unparseable body',
                httpStatus: 200,
                requestId: $requestId !== '' ? $requestId : null,
            );
        }
        $decoded = base64_decode($parsed['pdf_gzip_base64'], strict: true);
        if ($decoded === false) {
            throw new UnknownException(
                message: 'download: server returned an invalid base64 payload',
                httpStatus: 200,
            );
        }
        if (($parsed['compressed'] ?? true) === false) {
            return $decoded;
        }
        $inflated = @gzdecode($decoded);
        if ($inflated === false) {
            throw new UnknownException(
                message: 'download: failed to gunzip server payload',
                httpStatus: 200,
            );
        }
        return $inflated;
    }

    /**
     * Returns true if a stored document exists, false if not, null on
     * transient failure (caller retries the probe).
     */
    private function probeStoredDocumentSafely(string $signId): ?bool
    {
        $url = $this->transport->baseUrl . self::PATH_DOCUMENTS . '/' . rawurlencode($signId) . '/download';
        try {
            $response = $this->transport->send('GET', $url, [], '');
        } catch (UnknownException) {
            return null;
        } catch (RapidSignException $e) {
            return $e->retryable() ? null : throw $e;
        }
        $status = $response->getStatusCode();
        if ($status === 404) {
            return false;
        }
        if ($this->isSuccess($response)) {
            return true;
        }
        $err = HttpTransport::exceptionFor($response);
        if ($err->retryable()) {
            return null;
        }
        throw $err;
    }

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function callJson(string $method, string $path, array $body, ?string $idempotencyKey): array
    {
        $serialized = json_encode($body, JSON_THROW_ON_ERROR);
        $headers = ['Content-Type' => 'application/json'];
        if ($idempotencyKey !== null) {
            $headers['Idempotency-Key'] = $idempotencyKey;
        }

        $attempt = 0;
        $url = $this->transport->baseUrl . $path;
        while (true) {
            $response = $this->transport->send($method, $url, $headers, $serialized);
            if ($this->isSuccess($response)) {
                $decoded = $this->safeJsonDecode((string) $response->getBody());
                return $decoded ?? [];
            }
            $err = HttpTransport::exceptionFor($response);
            if (! $err->retryable() || $attempt >= $this->transport->maxRetries) {
                throw $err;
            }
            $this->transport->sleeper->sleepMs($this->retrySleepMs($err->retryAfterMs() ?? $this->backoffMs($attempt), null));
            $attempt++;
        }
    }

    private function isSuccess(ResponseInterface $response): bool
    {
        $status = $response->getStatusCode();
        return $status >= 200 && $status < 300;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function safeJsonDecode(string $body): ?array
    {
        if ($body === '') {
            return null;
        }
        try {
            $decoded = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string,?string> $params
     */
    private function querystring(array $params): string
    {
        $filtered = [];
        foreach ($params as $k => $v) {
            if ($v !== null && $v !== '') {
                $filtered[$k] = $v;
            }
        }
        return $filtered === [] ? '' : ('?' . http_build_query($filtered));
    }

    private function requireSignId(string $signId): void
    {
        if ($signId === '') {
            throw new ValidationException(
                message: 'signId is required',
                param: 'signId',
            );
        }
    }

    private function clampTimeout(string|int|null $timeout): int
    {
        if ($timeout === null) {
            return self::DEFAULT_AWAIT_TIMEOUT_MS;
        }
        $ms = Duration::parse($timeout);
        if ($ms > Duration::MAX_MS) {
            throw new ValidationException(
                message: sprintf('awaitSignature: timeout %dms exceeds maximum of %dms', $ms, Duration::MAX_MS),
                param: 'timeout',
            );
        }
        return $ms;
    }

    private function nextPollDelayMs(int $attempt): int
    {
        $target = min(self::POLL_BASE_MS * (2 ** $attempt), self::POLL_MAX_MS);
        return $this->applyJitter((int) $target);
    }

    private function backoffMs(int $attempt): int
    {
        $target = min(self::BACKOFF_BASE_MS * (2 ** $attempt), self::BACKOFF_MAX_MS);
        return $this->applyJitter((int) $target);
    }


    private function retrySleepMs(int $sleepMs, ?int $deadlineMs): int
    {
        if ($deadlineMs === null) {
            return $sleepMs;
        }
        $remaining = $deadlineMs - $this->clock->nowMs();
        if ($remaining <= 0) {
            throw new DeadlineExceededException(
                message: 'request retry budget exhausted before the await deadline',
            );
        }
        return min($sleepMs, $remaining);
    }

    private function applyJitter(int $targetMs): int
    {
        $v = random_int(0, 255) / 255.0;
        $offset = ($v * 2 - 1) * self::POLL_JITTER;
        return (int) floor($targetMs * (1 + $offset));
    }
}
