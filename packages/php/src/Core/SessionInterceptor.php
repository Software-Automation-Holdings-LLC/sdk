<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

use GuzzleHttp\Psr7\Utils;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Sah\Sdk\Zyins\SignRequest;

/**
 * Transparent PSR-18 client wrapper that signs every outbound product
 * request with the cached session and retries once on 401
 * `session_expired`.
 *
 * Wiring at the PSR-18 transport seam means every existing product
 * surface (zyins, account, rapidsign, proxy) inherits auto-refresh
 * without per-method changes — they already send requests through a
 * ClientInterface.
 *
 * Behavior:
 *   1. On every sendRequest, read SessionStore::currentSecret(). If
 *      null, call SessionStore::bootstrap() (idempotent under serial
 *      PHP execution; double-checks the cache before issuing the
 *      round-trip).
 *   2. Compute the four canonical session-auth headers
 *      (Authorization, X-Isa-Session-Id, X-Isa-Timestamp,
 *      X-Isa-Signature) and attach.
 *   3. Forward to the inner client.
 *   4. On 401 with code='session_expired' in the ProblemDetails body,
 *      invalidate + bootstrap + replay once. A second 401 is returned.
 */
final class SessionInterceptor implements ClientInterface
{
    public function __construct(
        private readonly SessionStore $store,
        private readonly ClientInterface $inner,
    ) {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $request = self::withReplayableBody($request);
        $resp = $this->signAndSend($request);
        [$expired, $resp] = self::sessionExpired($resp);
        if (!$expired) {
            return $resp;
        }
        $this->store->invalidate();
        return $this->signAndSend($request);
    }

    private function signAndSend(RequestInterface $request): ResponseInterface
    {
        $sess = $this->store->currentSecret() ?? $this->store->bootstrap();
        $stream = $request->getBody();
        if ($stream->isSeekable()) {
            $stream->rewind();
        }
        $body = (string) $stream;
        if ($stream->isSeekable()) {
            $stream->rewind();
        }
        $headers = SignRequest::sign(
            $request->getMethod(),
            self::requestTarget($request),
            $body,
            $sess->sessionId,
            $sess->sessionSecret,
        );
        $signed = $request;
        foreach ($headers as $name => $value) {
            $signed = $signed->withHeader($name, $value);
        }
        return $this->inner->sendRequest($signed);
    }

    private static function requestTarget(RequestInterface $request): string
    {
        $uri = $request->getUri();
        $path = $uri->getPath();
        if (strlen($path) === 0) {
            $path = '/';
        }
        $query = $uri->getQuery();
        if (strlen($query) === 0) {
            return $path;
        }
        return $path . '?' . $query;
    }

    private static function withReplayableBody(RequestInterface $request): RequestInterface
    {
        $stream = $request->getBody();
        if ($stream->isSeekable()) {
            $stream->rewind();
            return $request;
        }

        return $request->withBody(Utils::streamFor((string) $stream));
    }

    /**
     * @return array{bool, ResponseInterface}
     */
    private static function sessionExpired(ResponseInterface $resp): array
    {
        if ($resp->getStatusCode() !== 401) {
            return [false, $resp];
        }
        $contentType = $resp->getHeaderLine('Content-Type');
        if (stripos($contentType, 'json') === false) {
            return [false, $resp];
        }
        $body = (string) $resp->getBody();
        if ($resp->getBody()->isSeekable()) {
            $resp->getBody()->rewind();
        } else {
            $resp = $resp->withBody(Utils::streamFor($body));
        }
        try {
            $payload = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [false, $resp];
        }
        return [is_array($payload) && ($payload['code'] ?? null) === 'session_expired', $resp];
    }
}
