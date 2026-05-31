<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\Reference\Internal\V3Coercion;
use Isa\Sdk\Zyins\Reference\Internal\V3WireBody;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * `POST /v3/quote` — v3 quote operation.
 *
 * Shares the uniform `pricing[]` table and the flat `plans[]` envelope
 * with v3 prequalify (see {@see V3Offer}). Both endpoints answer one flat
 * array; group client-side with {@see PrequalifyV3Result::byAmount()} on
 * the requested dimension (deathBenefit for face amounts, budget for
 * monthly budgets).
 */
final readonly class QuoteV3
{
    private const PATH = '/v3/quote';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * @throws IsaException on 4xx/5xx wire responses.
     */
    public function run(QuoteV3Request $request, ?RequestOptions $options = null): QuoteV3Result
    {
        $body = V3WireBody::build(
            $request->applicant,
            $request->coverage,
            $request->products,
            $request->options,
        );
        $opts = $options ?? RequestOptions::default();
        $rawBody = V3Coercion::encodeRequestBody($body, 'quoteV3');
        $raw = $this->transport->sendRaw('POST', self::PATH, $rawBody, $opts);
        // See PrequalifyV3::run() — the transport may have minted the
        // Idempotency-Key, so the result echo and the failure-mapping
        // sentinel must read from `RawResponse::$sentIdempotencyKey`.
        $sentKey = $raw->sentIdempotencyKey ?? $opts->idempotencyKey;
        if ($raw->status < 200 || $raw->status >= 300) {
            throw Transport::exceptionFromRaw($raw, $sentKey);
        }
        return self::parseEnvelope($raw->body, $sentKey, V3Coercion::retryAttempts($raw));
    }

    private static function parseEnvelope(string $body, ?string $sentIdempotencyKey, int $retryAttempts): QuoteV3Result
    {
        $decoded = V3Coercion::decodeResponseBody($body, 'quoteV3');
        $requestId = V3Coercion::asString($decoded['request_id'] ?? null);
        $echoKey = V3Coercion::asString($decoded['idempotency_key'] ?? null);
        if ($echoKey === '') {
            $echoKey = $sentIdempotencyKey ?? '';
        }
        $livemode = array_key_exists('livemode', $decoded)
            ? V3Coercion::asBool($decoded['livemode'])
            : true;
        $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
        // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
        if (! array_key_exists('plans', $data)) {
            throw new \RuntimeException('ZyIns quoteV3: missing plans field in v3 response');
        }
        $plansRaw = is_array($data['plans']) ? $data['plans'] : [];
        $plans = [];
        foreach ($plansRaw as $raw) {
            $plans[] = V3Coercion::offer($raw);
        }
        return new QuoteV3Result(
            plans: $plans,
            requestId: $requestId,
            idempotencyKey: $echoKey,
            livemode: $livemode,
            retryAttempts: $retryAttempts,
        );
    }
}
