<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;
use InvalidArgumentException;

/**
 * Default {@see CaseStorage} adapter — preserves the locked E2EE Phase 2
 * contract on the wire shape: opaque JSON envelope posted to
 * `POST /v1/case`, opaque envelope fetched from `GET /v1/case/{id}`.
 *
 * The TS canonical implementation (see
 * `packages/ts/src/zyins/cases/ZeroKnowledgeCaseStorage.ts`) layers
 * AES-256-GCM encryption of the payload before the wire call and
 * returns the base64url key as `recallToken`. This PHP adapter ships
 * the locked surface today; the crypto envelope is a follow-up
 * (tracked alongside the parallel sdk-php case-store-e2ee work) — until
 * then `recallToken` is `null` and the payload travels as plain JSON
 * inside the envelope.
 *
 * Recall returns `null` on `404` (absent / expired — by design no
 * distinction); any other non-2xx surfaces as an {@see IsaException}.
 */
final class ZeroKnowledgeCaseStorage implements CaseStorage
{
    private const CASE_PATH = '/v1/case';

    /** Status code that maps to a `null` record on recall. */
    private const HTTP_NOT_FOUND = 404;

    public function __construct(private readonly Transport $transport)
    {
    }

    public function put(CaseRecord $record): CaseStoragePutResult
    {
        if ($record->product === '') {
            throw new InvalidArgumentException(
                'ZeroKnowledgeCaseStorage::put: CaseRecord->product must be non-empty',
            );
        }
        if ($record->payload === null) {
            throw new InvalidArgumentException(
                'ZeroKnowledgeCaseStorage::put: CaseRecord->payload must not be null',
            );
        }
        $body = [
            'product' => $record->product,
            'payload' => $record->payload,
        ];
        $response = $this->transport->post(self::CASE_PATH, $body);
        /** @var array<string,mixed> $data */
        $data = $response->data;
        $id = self::pickId($data);
        return new CaseStoragePutResult(id: $id, recallToken: null);
    }

    public function get(string $id, ?string $recallToken = null): ?CaseRecord
    {
        if ($id === '') {
            throw new InvalidArgumentException(
                'ZeroKnowledgeCaseStorage::get: id must be non-empty',
            );
        }
        $path = self::CASE_PATH . '/' . rawurlencode($id);
        // `sendRaw` bypasses the 4xx/5xx exception funnel so a 404 can
        // map cleanly to `null` (absent/expired — by design no
        // distinction); any other non-2xx is re-thrown through the
        // shared mapping.
        $raw = $this->transport->sendRaw('GET', $path, null, RequestOptions::default());
        if ($raw->status === self::HTTP_NOT_FOUND) {
            return null;
        }
        if ($raw->status < 200 || $raw->status >= 300) {
            throw Transport::exceptionFromRaw($raw);
        }
        if ($raw->body === '') {
            return null;
        }
        try {
            /** @var mixed $decoded */
            $decoded = json_decode($raw->body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new IsaException(
                message: 'ZeroKnowledgeCaseStorage::get: response body is not valid JSON: ' . $e->getMessage(),
                errorCode: 'invalid_response',
                previous: $e,
            );
        }
        if (! is_array($decoded)) {
            return null;
        }
        $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : $decoded;
        return self::recordFromWire($data);
    }

    /**
     * @param array<int|string,mixed> $data
     */
    private static function pickId(array $data): string
    {
        // Server envelope places the case id under `hash` (legacy) or
        // `id`; honor either so this adapter survives the eventual
        // /v1/case rename without a wire-format flag day.
        $id = $data['id'] ?? $data['hash'] ?? null;
        if (! is_string($id) || $id === '') {
            throw new IsaException(
                message: 'ZeroKnowledgeCaseStorage::put: response missing case id',
                errorCode: 'invalid_response',
            );
        }
        return $id;
    }

    /**
     * @param array<int|string,mixed> $data
     */
    private static function recordFromWire(array $data): ?CaseRecord
    {
        $product = $data['product'] ?? null;
        if (! is_string($product) || $product === '') {
            return null;
        }
        // The legacy server returns the original input under `input`;
        // the opaque path will replace it with `ciphertext`/`iv`/`tag`.
        // Either way, surface the body verbatim so the consumer (or a
        // future decrypting adapter) decides how to interpret it.
        $payload = $data['payload'] ?? $data['input'] ?? null;
        return new CaseRecord(product: $product, payload: $payload);
    }
}
