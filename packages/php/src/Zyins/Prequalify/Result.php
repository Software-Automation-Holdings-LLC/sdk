<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Prequalify;

/**
 * Output of `prequalify->run()`.
 */
final readonly class Result
{
    /**
     * @param Plan[] $plans
     */
    public function __construct(
        public array $plans,
        public string $requestId,
        public string $idempotencyKey = '',
        public int $retryAttempts = 0,
    ) {
    }

    /**
     * Build from the decoded wire payload.
     *
     * The server wraps prequalify results in a standard envelope:
     * `{ object, request_id, data: { version, meta, results: { "<key>": [...Product] } } }`.
     *
     * The Transport layer unwraps the outer envelope and passes `data` here as
     * `$decoded`. The `results` map is keyed by face value or "default" for
     * single-face-value requests. Plans are collected from all result buckets
     * (typically just one) and projected into typed `Plan` instances.
     *
     * Each server Product entry carries `brand`, `plan` (tier name),
     * `pricing` (map of tier → modal → price string), `death_benefit` (face
     * value integer), and `id` (product token).
     *
     * Wire keys may be absent on partial responses; this method defaults to
     * safe values rather than throwing — exception construction is the
     * transport layer's job.
     *
     * @param array<int|string,mixed> $decoded
     */
    public static function fromWire(
        array $decoded,
        ?string $requestId = null,
        string $idempotencyKey = '',
        int $retryAttempts = 0,
    ): self {
        $plans = [];

        $hasModernResults = isset($decoded['results']) && is_array($decoded['results']) && $decoded['results'] !== [];
        $legacyPlans = $decoded['plans'] ?? [];
        if (! $hasModernResults && is_array($legacyPlans)) {
            foreach ($legacyPlans as $rawPlan) {
                if (! is_array($rawPlan)) {
                    continue;
                }
                $plans[] = new Plan(
                    brand: self::asString($rawPlan, 'brand'),
                    tier: self::asString($rawPlan, 'tier'),
                    monthlyPremium: self::asFloat($rawPlan, 'monthly_premium'),
                    faceValue: self::asInt($rawPlan, 'face_value'),
                    productToken: self::asString($rawPlan, 'product_token'),
                );
            }
        }

        // Results map: outer key is face-value label or "default", value is
        // array of Product objects with brand, plan, pricing, death_benefit, id.
        $results = $decoded['results'] ?? [];
        if (is_array($results)) {
            foreach ($results as $bucket) {
                if (! is_array($bucket)) {
                    continue;
                }
                foreach ($bucket as $rawProduct) {
                    if (! is_array($rawProduct)) {
                        continue;
                    }
                    $plans[] = new Plan(
                        brand: self::asString($rawProduct, 'brand'),
                        tier: self::asString($rawProduct, 'plan'),
                        monthlyPremium: self::extractMonthlyPremium($rawProduct),
                        faceValue: self::asInt($rawProduct, 'death_benefit'),
                        productToken: self::asString($rawProduct, 'id'),
                    );
                }
            }
        }

        return new self(
            plans: $plans,
            requestId: $requestId ?? '',
            idempotencyKey: $idempotencyKey,
            retryAttempts: $retryAttempts,
        );
    }

    /**
     * Extract the monthly premium from the server's pricing map.
     *
     * Pricing shape: `{ default: { monthly: "123.45", annual: "..." }, ... }`.
     * Returns 0.0 when pricing is absent or the monthly key is missing.
     *
     * @param array<int|string,mixed> $rawProduct
     */
    private static function extractMonthlyPremium(array $rawProduct): float
    {
        $pricing = $rawProduct['pricing'] ?? null;
        if (! is_array($pricing)) {
            return 0.0;
        }
        // Try the "default" tier first; if absent or malformed, fall back to
        // the first array-valued tier in the pricing map.
        $tier = $pricing['default'] ?? null;
        if (! is_array($tier)) {
            $tier = self::firstArrayTier($pricing);
            if ($tier === null) {
                return 0.0;
            }
        }
        $monthly = $tier['monthly'] ?? null;
        if (is_numeric($monthly)) {
            return (float) $monthly;
        }
        return 0.0;
    }

    /**
     * Find the first array-valued tier in a pricing map, skipping any
     * malformed (non-array) entries.
     *
     * @param array<int|string,mixed> $pricing
     * @return array<int|string,mixed>|null
     */
    private static function firstArrayTier(array $pricing): ?array
    {
        foreach ($pricing as $candidate) {
            if (is_array($candidate)) {
                return $candidate;
            }
        }
        return null;
    }

    /**
     * @param array<int|string,mixed> $raw
     */
    private static function asString(array $raw, string $key): string
    {
        $value = $raw[$key] ?? null;
        return is_string($value) ? $value : '';
    }

    /**
     * @param array<int|string,mixed> $raw
     */
    private static function asFloat(array $raw, string $key): float
    {
        $value = $raw[$key] ?? null;
        return is_numeric($value) ? (float) $value : 0.0;
    }

    /**
     * @param array<int|string,mixed> $raw
     */
    private static function asInt(array $raw, string $key): int
    {
        $value = $raw[$key] ?? null;
        return is_numeric($value) ? (int) $value : 0;
    }
}
