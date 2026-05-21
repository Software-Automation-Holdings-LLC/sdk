<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Prequalify;

use Sah\Sdk\Zyins\RawResponse;
use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Prequalify sub-service. The `run` method is the single common entry
 * point and is mirrored on the JS client's `prequalify()` method.
 *
 * Pair with {@see runWithRawResponse()} when the caller needs the raw
 * HTTP envelope (status, headers, effective URL) alongside the typed
 * result — matching the Stainless/OpenAI/Anthropic SDK convention.
 */
final readonly class Service
{
    private const PATH = '/v1/prequalify';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Run the prequalify decision for an applicant against the available products.
     *
     * @param Input               $input   Applicant demographics, coverage, products to evaluate.
     * @param RequestOptions|null $options Optional per-call overrides (idempotency key, timeout).
     *
     * @return Result Qualifying plans with the engine request id and idempotency key.
     *
     * @throws \Sah\Sdk\Zyins\Exception\IsaException                       on 4xx/5xx wire responses.
     * @throws \Sah\Sdk\Zyins\Exception\IsaIdempotencyConflictException     on idempotency-key reuse.
     * @throws \Sah\Sdk\Zyins\Exception\IsaRateLimitException               on rate limiting.
     *
     * @example
     * $result = $isa->prequalify->run(new Input(
     *     applicant: new Applicant(
     *         name: 'John Doe',
     *         dob: '1962-04-18',
     *         sex: Sex::Male,
     *         state: 'NC',
     *         heightInches: 70,
     *         weightLbs: 195,
     *         nicotineUse: NicotineUsage::None,
     *     ),
     *     coverage: Coverage::faceValue(25000),
     *     products: ['senior-life'],
     * ));
     *
     * @see https://docs.isaapi.com/zyins/prequalify
     */
    public function run(Input $input, ?RequestOptions $options = null): Result
    {
        $response = $this->transport->post(self::PATH, $input->toWireBody(), $options);
        return Result::fromWire(
            $response->data,
            $response->requestId,
            $response->idempotencyKey,
            $response->retryAttempts,
        );
    }

    /**
     * Raw-blob variant of {@see run()}. Accepts a pre-encoded
     * payload verbatim — useful for long-standing consumers (e.g.
     * bpp2.0's `prepEncObj` / `prepEncObjV2`) that already build the
     * wire body via their own encoder and would have to restructure
     * to pass through {@see Input}. Reuses the rest of the transport
     * machinery (auth, idempotency, error funnel, response parsing).
     *
     * The server accepts both the typed and legacy-blob shapes on
     * the same `/v1/prequalify` path.
     *
     * @param array<string,mixed> $encodedPayload Pre-encoded prequalify body.
     */
    public function legacyBlob(array $encodedPayload, ?RequestOptions $options = null): Result
    {
        $response = $this->transport->post(self::PATH, $encodedPayload, $options);
        return Result::fromWire(
            $response->data,
            $response->requestId,
            $response->idempotencyKey,
            $response->retryAttempts,
        );
    }

    /**
     * Same as {@see run()} but returns a `[Result, RawResponse]` pair so
     * callers can read response headers, the effective URL after
     * redirects, or the raw body without subclassing the transport.
     *
     * @return array{0: Result, 1: RawResponse}
     */
    public function runWithRawResponse(Input $input, ?RequestOptions $options = null): array
    {
        [$decoded, $raw] = $this->transport->postWithRaw(self::PATH, $input->toWireBody(), $options);
        return [
            Result::fromWire(
                $decoded->data,
                $decoded->requestId,
                $decoded->idempotencyKey,
                $decoded->retryAttempts,
            ),
            $raw,
        ];
    }
}
