<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineProductUsage;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\QuoteType;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Options;

/**
 * Wire-body builder for `POST /v3/prequalify`.
 *
 * Emits the `PrequalifyV3Request` envelope shape per the OpenAPI spec —
 * `{ applicant, coverage, products[] }`, with `applicant` carrying
 * demographics + conditions + medications + nicotine, and `coverage`
 * carrying `face_amount_cents` + `state`. This is NOT the legacy v2
 * flat shape — emitting `date_of_birth` / `gender` / `state` at the
 * payload root produces `unknown field "date_of_birth"` from the zyins
 * server (prod incident 2026-05-29).
 *
 * `/v3/quote` still consumes the v2 flat body via {@see V3WireBody}; do
 * not merge the two until the server contract aligns.
 *
 * Inputs the v3 envelope does NOT carry are dropped here rather than
 * sent through and rejected: `applicant.zip`, and every
 * {@see PrequalifyV3Options} field except `includeIneligible`. Callers
 * needing those affordances must use `/v3/quote` (legacy flat body).
 *
 * @see PrequalifyV3Request OpenAPI schema (go/zyins/api/openapi.yaml).
 */
final class V3PrequalifyWireBody
{
    /** Cents per dollar; v3 coverage speaks integer cents only. */
    private const CENTS_PER_DOLLAR = 100;

    /**
     * Map v2-era SDK frequency strings to the v3 `NicotineFrequencyV3`
     * enum the server accepts. The Tier 3 SDK currently surfaces
     * v2-grade strings on {@see NicotineProductUsage::$frequency}; we
     * coerce here so v3 callers don't need to know the wire names.
     *
     * @var array<string,string>
     */
    private const NICOTINE_FREQUENCY_MAP = [
        'daily'                => 'daily',
        'DAILY'                => 'daily',
        'weekly'               => 'few_times_per_week',
        'WEEKLY'               => 'few_times_per_week',
        'few_times_per_week'   => 'few_times_per_week',
        'monthly'              => 'few_times_per_month',
        'MONTHLY'              => 'few_times_per_month',
        'few_times_per_month'  => 'few_times_per_month',
        'yearly'               => 'few_times_per_year',
        'YEARLY'               => 'few_times_per_year',
        'few_times_per_year'   => 'few_times_per_year',
    ];

    private const NICOTINE_FREQUENCY_DEFAULT = 'daily';

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
        $applicantWire = [
            'sex' => $applicant->sex->value,
            'dob' => $applicant->dob,
            'height_inches' => $applicant->height->totalInches,
            'weight_lbs' => $applicant->weight->pounds,
            'nicotine' => self::serializeNicotine($applicant->nicotineUse),
        ];
        if ($applicant->conditions !== []) {
            $applicantWire['conditions'] = array_map(
                self::serializeCondition(...),
                $applicant->conditions,
            );
        }
        if ($applicant->medications !== []) {
            $applicantWire['medications'] = array_map(
                self::serializeMedication(...),
                $applicant->medications,
            );
        }

        $payload = [
            'applicant' => $applicantWire,
            'coverage' => self::buildCoverage($coverage, $applicant->state),
            'products' => Product::toWireArray($products),
        ];

        // v3 prequalify defaults `include_ineligible` to true: rows the
        // applicant does not qualify for surface with
        // `eligibility.eligible: false` rather than being dropped.
        $payload['include_ineligible'] = $options?->includeIneligible ?? true;

        return $payload;
    }

    private static function dollarsToCents(int $dollars): int
    {
        return $dollars * self::CENTS_PER_DOLLAR;
    }

    /**
     * Build the v3 coverage envelope from the input shape.
     *
     * A single face amount keeps the proven `{face_amount_cents}` shape
     * (integer cents). A single monthly budget and any multi-amount probe
     * ride the `/v3/quote` `quote_options` block — `{quote_type, amounts}`
     * — satisfying the server's additive `face_amount_cents` XOR
     * `quote_options` contract (zyins #400). `state` rides the envelope in
     * every case.
     *
     * @return array<string,mixed>
     */
    private static function buildCoverage(Coverage $coverage, string $state): array
    {
        if ($coverage->isMulti()) {
            $quoteType = $coverage->isFaceValue()
                ? QuoteType::FaceAmounts->value
                : QuoteType::MonthlyBudget->value;
            return [
                'quote_options' => [
                    'quote_type' => $quoteType,
                    'amounts' => array_map(static fn (int $a): string => (string) $a, $coverage->amounts),
                ],
                'state' => $state,
            ];
        }
        if (! $coverage->isFaceValue()) {
            // A single monthly budget has no face_amount_cents to express,
            // so it rides the quote_options block with one amount — the
            // same path the server accepts for the multi-amount budget
            // probe. A single face amount keeps the proven
            // face_amount_cents wire shape.
            return [
                'quote_options' => [
                    'quote_type' => QuoteType::MonthlyBudget->value,
                    'amounts' => [(string) $coverage->amount],
                ],
                'state' => $state,
            ];
        }
        return [
            'face_amount_cents' => self::dollarsToCents($coverage->amount),
            'state' => $state,
        ];
    }

    /** @return array<string,mixed> */
    private static function serializeCondition(Condition $c): array
    {
        $row = ['text' => $c->name];
        if ($c->wasDiagnosed !== '') {
            $row['was_diagnosed'] = $c->wasDiagnosed;
        }
        if ($c->lastTreatment !== '') {
            $row['last_treatment'] = $c->lastTreatment;
        }
        return $row;
    }

    /** @return array<string,mixed> */
    private static function serializeMedication(Medication $m): array
    {
        $row = ['text' => $m->name];
        if ($m->use !== '') {
            $row['use'] = $m->use;
        }
        if ($m->firstFill !== '') {
            $row['first_fill'] = $m->firstFill;
        }
        if ($m->lastFill !== '') {
            $row['last_fill'] = $m->lastFill;
        }
        return $row;
    }

    /** @return array<string,mixed> */
    private static function serializeNicotine(NicotineUsage|NicotineUsageInput $nicotine): array
    {
        if ($nicotine instanceof NicotineUsageInput) {
            $result = ['last_used' => $nicotine->lastUsed->value];
            if ($nicotine->productUsage !== []) {
                $result['specificity'] = array_map(
                    static fn (NicotineProductUsage $p): array => [
                        'text' => $p->type,
                        'frequency' => self::NICOTINE_FREQUENCY_MAP[$p->frequency]
                            ?? self::NICOTINE_FREQUENCY_DEFAULT,
                    ],
                    $nicotine->productUsage,
                );
            }
            return $result;
        }
        $lastUsed = match ($nicotine) {
            NicotineUsage::None    => NicotineDuration::Never,
            NicotineUsage::Current => NicotineDuration::Within12Months,
            NicotineUsage::Former  => NicotineDuration::N12To24Months,
        };
        return ['last_used' => $lastUsed->value];
    }

    private function __construct()
    {
    }
}
