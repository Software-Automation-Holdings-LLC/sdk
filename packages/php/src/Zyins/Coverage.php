<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Coverage discriminated union. The prequalify wire accepts either a
 * face value (death benefit in USD) or a monthly budget (USD/month);
 * bucket math lives server-side, so the SDK only carries the user's
 * stated intent.
 *
 * Construct via {@see Coverage::faceValue()} or
 * {@see Coverage::monthlyBudget()}; the discriminator is managed by
 * the SDK and never set directly by the caller.
 */
final readonly class Coverage
{
    public const TYPE_FACE_VALUE = 'face_value';
    public const TYPE_MONTHLY_BUDGET = 'monthly_budget';

    private function __construct(
        public string $type,
        public int $amount,
    ) {
    }

    public static function faceValue(int $amount): self
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Coverage::faceValue: amount must be positive');
        }
        return new self(self::TYPE_FACE_VALUE, $amount);
    }

    public static function monthlyBudget(int $amount): self
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Coverage::monthlyBudget: amount must be positive');
        }
        return new self(self::TYPE_MONTHLY_BUDGET, $amount);
    }

    public function isFaceValue(): bool
    {
        return $this->type === self::TYPE_FACE_VALUE;
    }

    public function isMonthlyBudget(): bool
    {
        return $this->type === self::TYPE_MONTHLY_BUDGET;
    }
}
