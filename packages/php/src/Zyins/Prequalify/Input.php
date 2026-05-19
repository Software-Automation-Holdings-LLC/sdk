<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Prequalify;

use InvalidArgumentException;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Condition;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Medication;
use Sah\Sdk\Zyins\Product;

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
     * Serialize to the wire body shape. Top-level applicant fields are
     * the engine's documented snake_case contract (`height_inches`,
     * `weight_pounds`, `nicotine_use`); nested medication and condition
     * objects pass through with their canonical camelCase property names
     * (`firstFill`, `lastFill`, `wasDiagnosed`, `lastTreatment`) to match
     * the canonical JS SDK at `packages/zyins/js/src/prequalify.ts`. The
     * SDK locks this shape so call sites never touch wire keys directly.
     *
     * The optional `zip` field is omitted when null rather than serialized
     * as `"zip": null`, mirroring the JS SDK's conditional-spread behavior
     * and avoiding strict-schema rejection on the server.
     *
     * @return array<string,mixed>
     */
    public function toWireBody(): array
    {
        $applicant = [
            'dob' => $this->applicant->dob,
            'sex' => $this->applicant->sex->wireCode(),
            'height_inches' => $this->applicant->height->totalInches,
            'weight_pounds' => $this->applicant->weight->pounds,
            'state' => $this->applicant->state,
            'nicotine_use' => $this->applicant->nicotineUse->value,
            'medications' => array_map(
                static fn (Medication $m): array => [
                    'name' => $m->name,
                    'use' => $m->use,
                    'firstFill' => $m->firstFill,
                    'lastFill' => $m->lastFill,
                ],
                $this->applicant->medications,
            ),
            'conditions' => array_map(
                static fn (Condition $c): array => [
                    'name' => $c->name,
                    'wasDiagnosed' => $c->wasDiagnosed,
                    'lastTreatment' => $c->lastTreatment,
                ],
                $this->applicant->conditions,
            ),
        ];
        if ($this->applicant->zip !== null) {
            $applicant['zip'] = $this->applicant->zip;
        }
        return [
            'products' => Product::toWireString($this->products),
            'applicant' => $applicant,
            'coverage' => [
                'type' => $this->coverage->type,
                'amount' => $this->coverage->amount,
            ],
        ];
    }
}
