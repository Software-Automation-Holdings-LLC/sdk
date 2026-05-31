<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Prequalify;

use InvalidArgumentException;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\QuoteType;

/**
 * Inputs accepted by `prequalify->run()`.
 */
final readonly class Input
{
    /**
     * @param Product[] $products
     */
    public function __construct(
        public Applicant $applicant,
        public Coverage $coverage,
        public array $products,
    ) {
        if ($this->products === []) {
            throw new InvalidArgumentException('PrequalifyInput requires at least one product');
        }
        foreach ($this->products as $product) {
            if (! $product instanceof Product) {
                throw new InvalidArgumentException('PrequalifyInput.products must contain Product instances only');
            }
        }
    }

    /**
     * Serialize to the flat wire body the server expects (0.5.1+).
     *
     * Wire shape:
     * ```json
     * {
     *   "date_of_birth": "YYYY-MM-DD",
     *   "gender": "male" | "female",
     *   "height": <inches>,
     *   "weight": <pounds>,
     *   "state": "<state>",
     *   "nicotine_usage": { "last_used": "<NicotineLastUsed>", ... },
     *   "products": ["<slug>", ...],
     *   "conditions": [...],
     *   "medications": [...],
     *   "quote_options": { "amounts": ["<amount>"], "quote_type": "..." }
     * }
     * ```
     *
     * Auth credentials belong in HMAC headers only — never in the body.
     * No `applicant`/`coverage` nesting per ADR-035.
     *
     * @return array<string,mixed>
     */
    public function toWireBody(): array
    {
        $payload = [
            'date_of_birth' => $this->applicant->dob,
            'gender'        => $this->applicant->sex->value,
            'height'        => $this->applicant->height->totalInches,
            'weight'        => $this->applicant->weight->pounds,
            'state'         => $this->applicant->state,
            'nicotine_usage' => $this->serializeNicotineUsage(),
            'products'      => Product::toWireArray($this->products),
            'conditions'    => array_map(
                static fn (Condition $c): array => [
                    'name'         => $c->name,
                    'wasDiagnosed' => $c->wasDiagnosed,
                    'lastTreatment' => $c->lastTreatment,
                ],
                $this->applicant->conditions,
            ),
            'medications'   => array_map(
                static fn (Medication $m): array => [
                    'name'      => $m->name,
                    'use'       => $m->use,
                    'firstFill' => $m->firstFill,
                    'lastFill'  => $m->lastFill,
                ],
                $this->applicant->medications,
            ),
            'quote_options' => $this->serializeQuoteOptions(),
        ];

        if ($this->applicant->zip !== null) {
            $payload['zip'] = $this->applicant->zip;
        }

        return $payload;
    }

    /** @return array<string,mixed> */
    private function serializeNicotineUsage(): array
    {
        $nicotineUse = $this->applicant->nicotineUse;

        if ($nicotineUse instanceof NicotineUsageInput) {
            $result = ['last_used' => $nicotineUse->lastUsed->value];
            if ($nicotineUse->productUsage !== []) {
                $result['product_usage'] = array_map(
                    static fn (object $p): array => ['type' => $p->type, 'frequency' => $p->frequency],
                    $nicotineUse->productUsage,
                );
            }
            return $result;
        }

        // Deprecated NicotineUsage enum — map to nearest NicotineDuration bucket.
        $lastUsed = match ($nicotineUse) {
            NicotineUsage::None    => NicotineDuration::Never,
            NicotineUsage::Current => NicotineDuration::Within12Months,
            NicotineUsage::Former  => NicotineDuration::N12To24Months,
        };

        return ['last_used' => $lastUsed->value];
    }

    /** @return array<string,mixed> */
    private function serializeQuoteOptions(): array
    {
        $quoteType = $this->coverage->isFaceValue()
            ? QuoteType::FaceAmounts
            : QuoteType::MonthlyBudget;

        return [
            'amounts'    => [(string) $this->coverage->amount],
            'quote_type' => $quoteType->value,
        ];
    }
}
