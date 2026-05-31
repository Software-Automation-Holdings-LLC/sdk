<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\Reference\Internal\V3Coercion;
use Isa\Sdk\Zyins\Reference\Internal\V3PrequalifyWireBody;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * `POST /v3/prequalify` — uniform `pricing[]` table per product.
 *
 * The v3 contract collapses v2's `premium` + `other_offers` split into
 * one ordered pricing table per product. Money is integer cents paired
 * with a server-formatted `display`; array order is authoritative for
 * UI rendering — no `result_index`, no client-side sort keys.
 *
 * Idempotency: every v3 mutating call MUST carry a UUID v4 in the
 * `Idempotency-Key` header. The transport auto-mints one when the
 * caller does not supply one via {@see RequestOptions::withIdempotencyKey()}.
 */
final readonly class PrequalifyV3
{
    private const PATH = '/v3/prequalify';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Run a v3 prequalification.
     *
     * @throws IsaException on 4xx/5xx wire responses.
     */
    public function run(
        PrequalifyV3Request $request,
        ?RequestOptions $options = null,
    ): PrequalifyV3Result {
        $body = V3PrequalifyWireBody::build(
            $request->applicant,
            $request->coverage,
            $request->products,
            $request->options,
        );
        $opts = $options ?? RequestOptions::default();
        // `Api-Version: v3` pins the operation to the v3 envelope shape
        // even when a transport-layer middleware rewrites the URL. The
        // server uses the header as the authoritative routing signal.
        // HTTP header names are case-insensitive (RFC 9110 §5.1), so the
        // presence check must be too — otherwise a caller supplying
        // `api-version` would produce a duplicate, conflicting header.
        if (! self::hasHeader($opts->extraHeaders, 'Api-Version')) {
            $opts = $opts->withExtraHeaders(['Api-Version' => 'v3']);
        }
        $rawBody = V3Coercion::encodeRequestBody($body, 'prequalifyV3');
        $raw = $this->transport->sendRaw('POST', self::PATH, $rawBody, $opts);
        // Read the resolved Idempotency-Key from RawResponse, not the input
        // options — when the caller didn't supply one, the transport minted a
        // UUID and we MUST surface that exact value (or 409 conflict
        // exceptions and the result's `idempotencyKey` echo lose the value).
        $sentKey = $raw->sentIdempotencyKey ?? $opts->idempotencyKey;
        if ($raw->status < 200 || $raw->status >= 300) {
            throw Transport::exceptionFromRaw($raw, $sentKey);
        }
        return self::parseEnvelope($raw->body, $sentKey, V3Coercion::retryAttempts($raw));
    }

    /**
     * Case-insensitive header-name presence check (HTTP header names are
     * case-insensitive per RFC 9110 §5.1).
     *
     * @param array<string,string> $headers
     */
    private static function hasHeader(array $headers, string $name): bool
    {
        foreach (array_keys($headers) as $candidate) {
            if (strcasecmp((string) $candidate, $name) === 0) {
                return true;
            }
        }
        return false;
    }

    private static function parseEnvelope(string $body, ?string $sentIdempotencyKey, int $retryAttempts): PrequalifyV3Result
    {
        $decoded = V3Coercion::decodeResponseBody($body, 'prequalifyV3');
        $requestId = V3Coercion::asString($decoded['request_id'] ?? null);
        $echoKey = V3Coercion::asString($decoded['idempotency_key'] ?? null);
        if ($echoKey === '') {
            $echoKey = $sentIdempotencyKey ?? '';
        }
        $livemode = array_key_exists('livemode', $decoded)
            ? V3Coercion::asBool($decoded['livemode'])
            : true;
        $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
        // The v3 response is always a flat `plans[]` array — single amount
        // and multi-amount alike. Group client-side with
        // PrequalifyV3Result::byAmount on the requested dimension
        // (deathBenefit for face amounts, budget for monthly budgets).
        // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
        if (! array_key_exists('plans', $data)) {
            throw new \RuntimeException('ZyIns prequalifyV3: missing plans field in v3 response');
        }
        $plansRaw = is_array($data['plans']) ? $data['plans'] : [];
        $plans = [];
        foreach ($plansRaw as $raw) {
            $plans[] = V3Coercion::offer($raw);
        }
        return new PrequalifyV3Result(
            plans: $plans,
            requestId: $requestId,
            idempotencyKey: $echoKey,
            livemode: $livemode,
            retryAttempts: $retryAttempts,
        );
    }
}
