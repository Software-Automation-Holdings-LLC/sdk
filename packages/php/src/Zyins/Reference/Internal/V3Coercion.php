<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\RawResponse;
use Isa\Sdk\Zyins\Reference\V3Amount;
use Isa\Sdk\Zyins\Reference\V3Eligibility;
use Isa\Sdk\Zyins\Reference\V3EligibilityCategory;
use Isa\Sdk\Zyins\Reference\V3Money;
use Isa\Sdk\Zyins\Reference\V3Offer;
use Isa\Sdk\Zyins\Reference\V3OfferCarrier;
use Isa\Sdk\Zyins\Reference\V3OfferProduct;
use Isa\Sdk\Zyins\Reference\V3Period;
use Isa\Sdk\Zyins\Reference\V3Premium;
use Isa\Sdk\Zyins\Reference\V3PricingRow;

/**
 * Shared parser helpers for `/v3/prequalify` and `/v3/quote` responses.
 *
 * Defensive but never lossy: missing fields become safe defaults, no
 * field invents a value the wire didn't provide. The same conventions
 * mirror `packages/ts/src/zyins/v3Coercion.ts`.
 */
final class V3Coercion
{
    public static function asString(mixed $v): string
    {
        return is_string($v) ? $v : '';
    }

    public static function asInt(mixed $v): int
    {
        if (is_int($v)) {
            return $v;
        }
        if (is_float($v) && is_finite($v)) {
            return (int) $v;
        }
        return 0;
    }

    public static function asNullableInt(mixed $v): ?int
    {
        if (is_int($v)) {
            return $v;
        }
        if (is_float($v) && is_finite($v)) {
            return (int) $v;
        }
        return null;
    }

    public static function asBool(mixed $v): bool
    {
        return $v === true;
    }

    public static function carrier(mixed $raw): V3OfferCarrier
    {
        $r = is_array($raw) ? $raw : [];
        return new V3OfferCarrier(
            id: self::asString($r['id'] ?? null),
            name: self::asString($r['name'] ?? null),
            logoUrl: self::asString($r['logo_url'] ?? null),
        );
    }

    public static function product(mixed $raw): V3OfferProduct
    {
        $r = is_array($raw) ? $raw : [];
        return new V3OfferProduct(
            id: self::asString($r['id'] ?? null),
            slug: self::asString($r['slug'] ?? null),
            name: self::asString($r['name'] ?? null),
            displayName: self::asString($r['display_name'] ?? null),
            type: self::asString($r['type'] ?? null),
            wireToken: self::asString($r['wire_token'] ?? null),
        );
    }

    /** Coerce the leaf `{cents, display}` amount (OpenAPI `AmountResponse`). */
    public static function amount(mixed $raw): V3Amount
    {
        $r = is_array($raw) ? $raw : [];
        return new V3Amount(
            cents: self::asInt($r['cents'] ?? null),
            display: self::asString($r['display'] ?? null),
        );
    }

    /**
     * Coerce a `{amount: {cents, display}, period}` value (OpenAPI `Money`).
     * `period` falls back to `null` (a one-time lump sum) for any value
     * outside the closed enum, so an unknown future period never poisons
     * the type.
     */
    public static function money(mixed $raw): V3Money
    {
        $r = is_array($raw) ? $raw : [];
        $periodRaw = is_string($r['period'] ?? null) ? $r['period'] : null;
        $period = $periodRaw !== null ? V3Period::tryFrom($periodRaw) : null;
        return new V3Money(
            amount: self::amount($r['amount'] ?? null),
            period: $period,
        );
    }

    public static function eligibility(mixed $raw): V3Eligibility
    {
        $r = is_array($raw) ? $raw : [];
        $categoryRaw = is_string($r['category'] ?? null) ? $r['category'] : null;
        $category = match ($categoryRaw) {
            'immediate' => V3EligibilityCategory::Immediate,
            'graded' => V3EligibilityCategory::Graded,
            'rop' => V3EligibilityCategory::Rop,
            'other' => V3EligibilityCategory::Other,
            default => null,
        };
        $reasonsRaw = is_array($r['reasons'] ?? null) ? $r['reasons'] : [];
        $reasons = [];
        foreach ($reasonsRaw as $s) {
            $reasons[] = self::asString($s);
        }
        return new V3Eligibility(
            category: $category,
            eligible: self::asBool($r['eligible'] ?? null),
            reasons: $reasons,
        );
    }

    public static function premium(mixed $raw): ?V3Premium
    {
        if ($raw === null || ! is_array($raw)) {
            return null;
        }
        $modesRaw = is_array($raw['modes'] ?? null) ? $raw['modes'] : [];
        $modes = [];
        foreach ($modesRaw as $k => $v) {
            if (is_string($k)) {
                $modes[$k] = self::amount($v);
            }
        }
        return new V3Premium(
            cents: self::asInt($raw['cents'] ?? null),
            display: self::asString($raw['display'] ?? null),
            default: self::amount($raw['default'] ?? null),
            modes: $modes,
        );
    }

    /**
     * Encode a v3 request body to JSON, wrapping `JsonException` in an
     * `IsaException` so consumers only catch one error type.
     *
     * @param array<string,mixed> $body
     * @param string $operation The service name (e.g. `prequalifyV3`) so
     *        the exception's message names the right call site.
     */
    public static function encodeRequestBody(array $body, string $operation): string
    {
        try {
            return json_encode($body, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new IsaException(
                message: $operation . ': failed to encode request body: ' . $e->getMessage(),
                errorCode: 'invalid_request',
                previous: $e,
            );
        }
    }

    /**
     * Decode a v3 response body to an associative array, wrapping
     * `JsonException` in an `IsaException`. Empty string returns `[]`
     * so callers can pull `data` etc. uniformly.
     *
     * @return array<string,mixed>
     */
    public static function decodeResponseBody(string $body, string $operation): array
    {
        if ($body === '') {
            return [];
        }
        try {
            $decoded = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new IsaException(
                message: $operation . ': failed to parse response body: ' . $e->getMessage(),
                errorCode: 'invalid_response',
                previous: $e,
            );
        }
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Read the `Retry-Attempts` header the server sets on v3 responses
     * (falls back to `X-Retry-Attempts` for older deployments). `0` on
     * absent / non-numeric values.
     */
    public static function retryAttempts(RawResponse $raw): int
    {
        $header = $raw->header('Retry-Attempts') ?? $raw->header('X-Retry-Attempts');
        if ($header === null || ! ctype_digit($header)) {
            return 0;
        }
        return (int) $header;
    }

    public static function pricingRow(mixed $raw): V3PricingRow
    {
        $r = is_array($raw) ? $raw : [];
        return new V3PricingRow(
            rateClass: self::asString($r['rate_class'] ?? null),
            primary: self::asBool($r['primary'] ?? null),
            eligibility: self::eligibility($r['eligibility'] ?? null),
            rank: self::asNullableInt($r['rank'] ?? null),
            premium: self::premium($r['premium'] ?? null),
        );
    }

    /**
     * Coerce one flat `plans[]` entry. Shared by {@see PrequalifyV3} and
     * {@see QuoteV3} — both endpoints return the identical {@see V3Offer}
     * shape. `budget` is present only on monthly-budget responses.
     */
    public static function offer(mixed $raw): V3Offer
    {
        $r = is_array($raw) ? $raw : [];
        $pricingRaw = is_array($r['pricing'] ?? null) ? $r['pricing'] : [];
        $pricing = [];
        foreach ($pricingRaw as $row) {
            $pricing[] = self::pricingRow($row);
        }
        $planInfo = is_array($r['plan_info'] ?? null) ? array_values($r['plan_info']) : [];
        $metadata = is_array($r['metadata'] ?? null) ? $r['metadata'] : [];
        $object = self::asString($r['object'] ?? null);
        $budget = is_array($r['budget'] ?? null) ? self::money($r['budget']) : null;
        return new V3Offer(
            object: $object !== '' ? $object : 'plan_offer',
            id: self::asString($r['id'] ?? null),
            eligible: self::asBool($r['eligible'] ?? null),
            carrier: self::carrier($r['carrier'] ?? null),
            product: self::product($r['product'] ?? null),
            planInfo: $planInfo,
            deathBenefit: self::money($r['death_benefit'] ?? null),
            pricing: $pricing,
            metadata: $metadata,
            budget: $budget,
        );
    }

    private function __construct()
    {
    }
}
