<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Coverage discriminated union. The prequalify wire accepts either a
 * face value (death benefit in USD) or a monthly budget (USD/month),
 * for a single amount or several amounts probed in one call; bucket math
 * lives server-side, so the SDK only carries the user's stated intent.
 *
 * Construct via {@see Coverage::faceValue()} / {@see Coverage::monthlyBudget()}
 * (single) or {@see Coverage::faceValues()} / {@see Coverage::monthlyBudgets()}
 * (multi); the discriminator is managed by the SDK and never set directly
 * by the caller.
 */
final readonly class Coverage
{
    public const TYPE_FACE_VALUE = 'face_value';
    public const TYPE_MONTHLY_BUDGET = 'monthly_budget';

    /**
     * @param int        $amount  Whole-dollar amount for a single-amount coverage; 0 for multi.
     * @param list<int>  $amounts Whole-dollar amounts for a multi-amount probe; empty for single.
     */
    private function __construct(
        public string $type,
        public int $amount,
        public array $amounts = [],
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

    /**
     * Probe several face-value (death-benefit) amounts in one call.
     *
     * @param list<int> $amounts
     */
    public static function faceValues(array $amounts): self
    {
        return new self(self::TYPE_FACE_VALUE, 0, self::requirePositive('faceValues', $amounts));
    }

    /**
     * Probe several monthly-premium ceilings in one call.
     *
     * @param list<int> $amounts
     */
    public static function monthlyBudgets(array $amounts): self
    {
        return new self(self::TYPE_MONTHLY_BUDGET, 0, self::requirePositive('monthlyBudgets', $amounts));
    }

    public function isFaceValue(): bool
    {
        return $this->type === self::TYPE_FACE_VALUE;
    }

    public function isMonthlyBudget(): bool
    {
        return $this->type === self::TYPE_MONTHLY_BUDGET;
    }

    /** True when the coverage probes several amounts in one call. */
    public function isMulti(): bool
    {
        return $this->amounts !== [];
    }

    /**
     * @param list<int> $amounts
     * @return list<int>
     */
    private static function requirePositive(string $label, array $amounts): array
    {
        if ($amounts === []) {
            throw new InvalidArgumentException("Coverage::{$label}: at least one amount required");
        }
        foreach ($amounts as $a) {
            if ($a <= 0) {
                throw new InvalidArgumentException("Coverage::{$label}: amounts must be positive");
            }
        }
        return array_values($amounts);
    }
}
