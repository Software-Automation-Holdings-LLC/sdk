<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Prequalify;

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
     * Build from the decoded wire payload. Wire keys are snake_case
     * and may be missing on partial responses; this method tolerates
     * absence by defaulting to safe values rather than throwing —
     * exception construction is the transport layer's job.
     *
     * The `$requestId` is threaded in separately by the service so we
     * never have to scan the payload for a magic correlation key.
     *
     * @param array<int|string,mixed> $decoded
     */
    public static function fromWire(
        array $decoded,
        ?string $requestId = null,
        string $idempotencyKey = '',
        int $retryAttempts = 0,
    ): self {
        $rawPlans = $decoded['plans'] ?? [];
        $plans = [];
        if (is_array($rawPlans)) {
            foreach ($rawPlans as $rawPlan) {
                if (is_array($rawPlan)) {
                    $plans[] = new Plan(
                        brand: self::asString($rawPlan, 'brand'),
                        tier: self::asString($rawPlan, 'tier'),
                        monthlyPremium: self::asFloat($rawPlan, 'monthly_premium'),
                        faceValue: self::asInt($rawPlan, 'face_value'),
                        productToken: self::asString($rawPlan, 'product_token'),
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
