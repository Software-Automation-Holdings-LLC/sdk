<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\QuoteType;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Options;

/**
 * Shared `/v3/prequalify` + `/v3/quote` wire-body builder.
 *
 * Both endpoints take identical request payloads — only the response
 * shape differs (`plans[]` vs `results[]` grouped by amount). Build
 * once, reuse from both services. Mirrors the TS `serializeWireBody`.
 *
 * Layered options (`only_product_class`, `include_product_class`,
 * `min_rank`, etc.) merge over the typed `products` selection. Default
 * `include_ineligible` is `true` to match v3 semantics: ineligible rows
 * surface with `eligibility.eligible === false` rather than being
 * dropped silently.
 */
final class V3WireBody
{
    /**
     * @param list<Product> $products
     * @return array<string,mixed>
     */
    public static function build(
        Applicant $applicant,
        Coverage $coverage,
        array $products,
        ?PrequalifyV3Options $options,
    ): array {
        $payload = [
            'date_of_birth' => $applicant->dob,
            'gender' => $applicant->sex->value,
            'height' => $applicant->height->totalInches,
            'weight' => $applicant->weight->pounds,
            'state' => $applicant->state,
            'nicotine_usage' => self::serializeNicotineUsage($applicant),
            'conditions' => array_map(
                static fn (Condition $c): array => [
                    'name' => $c->name,
                    'wasDiagnosed' => $c->wasDiagnosed,
                    'lastTreatment' => $c->lastTreatment,
                ],
                $applicant->conditions,
            ),
            'medications' => array_map(
                static fn (Medication $m): array => [
                    'name' => $m->name,
                    'use' => $m->use,
                    'firstFill' => $m->firstFill,
                    'lastFill' => $m->lastFill,
                ],
                $applicant->medications,
            ),
            'quote_options' => self::serializeQuoteOptions($coverage),
            'products' => Product::toWireArray($products),
        ];

        if ($applicant->zip !== null) {
            $payload['zip'] = $applicant->zip;
        }

        if ($options !== null) {
            if ($options->onlyProductClass !== null) {
                $payload['only_product_class'] = $options->onlyProductClass;
            }
            if ($options->includeProductClass !== null && $options->includeProductClass !== []) {
                // `products` (typed selection) carries product wire
                // tokens; `include_product_class` is the layered
                // request-level set of class tokens. Today they don't
                // overlap on the wire — but mirror the TS dedupe to
                // future-proof against the day a class token leaks in.
                $merged = array_values(array_unique($options->includeProductClass));
                $payload['include_product_class'] = $merged;
            }
            if ($options->minRank !== null) {
                $payload['min_rank'] = $options->minRank;
            }
            if ($options->showUnreleased !== null) {
                $payload['show_unreleased'] = $options->showUnreleased;
            }
            if ($options->skipHealthBasedUnderwriting !== null) {
                $payload['skip_health_based_underwriting'] = $options->skipHealthBasedUnderwriting;
            }
            if ($options->includeIneligible !== null) {
                $payload['include_ineligible'] = $options->includeIneligible;
            }
        }
        if (! array_key_exists('include_ineligible', $payload)) {
            $payload['include_ineligible'] = true;
        }
        return $payload;
    }

    /** @return array<string,mixed> */
    private static function serializeNicotineUsage(Applicant $applicant): array
    {
        $nicotineUse = $applicant->nicotineUse;
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
        $lastUsed = match ($nicotineUse) {
            NicotineUsage::None => NicotineDuration::Never,
            NicotineUsage::Current => NicotineDuration::Within12Months,
            NicotineUsage::Former => NicotineDuration::N12To24Months,
        };
        return ['last_used' => $lastUsed->value];
    }

    /** @return array<string,mixed> */
    private static function serializeQuoteOptions(Coverage $coverage): array
    {
        $quoteType = $coverage->isFaceValue() ? QuoteType::FaceAmounts : QuoteType::MonthlyBudget;
        return [
            'quote_type' => $quoteType->value,
            'amounts' => [(string) $coverage->amount],
        ];
    }

    private function __construct()
    {
    }
}
