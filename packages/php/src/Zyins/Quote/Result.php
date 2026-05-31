<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Quote;

/**
 * Output of `quote->run()`. The shape mirrors the engine's
 * single-product CalcPrice response; future fields (modal factors,
 * fees) ship as additive optional properties.
 */
final readonly class Result
{
    public function __construct(
        public string $productToken,
        public string $tier,
        public float $monthlyPremium,
        public int $faceValue,
        public string $requestId,
    ) {
    }

    /**
     * @param array<int|string,mixed> $decoded
     */
    public static function fromWire(array $decoded, ?string $requestId = null): self
    {
        return new self(
            productToken: self::str($decoded, 'product_token'),
            tier: self::str($decoded, 'tier'),
            monthlyPremium: self::num($decoded, 'monthly_premium'),
            faceValue: (int) self::num($decoded, 'face_value'),
            requestId: $requestId ?? '',
        );
    }

    /**
     * @param array<int|string,mixed> $raw
     */
    private static function str(array $raw, string $key): string
    {
        $value = $raw[$key] ?? null;
        return is_string($value) ? $value : '';
    }

    /**
     * @param array<int|string,mixed> $raw
     */
    private static function num(array $raw, string $key): float
    {
        $value = $raw[$key] ?? null;
        return is_numeric($value) ? (float) $value : 0.0;
    }
}
