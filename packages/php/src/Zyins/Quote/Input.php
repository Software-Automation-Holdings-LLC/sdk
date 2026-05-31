<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Quote;

use InvalidArgumentException;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Product;

/**
 * Inputs accepted by `quote->run()`. A quote pins the applicant to a
 * single product (vs. prequalify's catalog scan) and returns the
 * carrier-bound rate the engine would book today.
 */
final readonly class Input
{
    public function __construct(
        public Applicant $applicant,
        public Coverage $coverage,
        public Product $product,
    ) {
        if ($product->wireToken === '') {
            throw new InvalidArgumentException('QuoteInput.product must have a non-empty wireToken');
        }
    }

    /**
     * Serialize to the wire body shape. Top-level applicant fields use
     * the engine's documented snake_case contract; the optional `zip`
     * field is omitted when null rather than serialized as `"zip": null`,
     * mirroring the JS SDK's conditional-spread behavior.
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
            'nicotine_use' => $this->serializeNicotineUse(),
        ];
        if ($this->applicant->zip !== null) {
            $applicant['zip'] = $this->applicant->zip;
        }
        return [
            'product' => $this->product->wireToken,
            'applicant' => $applicant,
            'coverage' => [
                'type' => $this->coverage->type,
                'amount' => $this->coverage->amount,
            ],
        ];
    }

    private function serializeNicotineUse(): string
    {
        $nicotineUse = $this->applicant->nicotineUse;
        if (! $nicotineUse instanceof NicotineUsageInput) {
            return $nicotineUse->value;
        }

        return match ($nicotineUse->lastUsed) {
            NicotineDuration::Never => 'none',
            NicotineDuration::Within12Months => 'current',
            default => 'former',
        };
    }
}
