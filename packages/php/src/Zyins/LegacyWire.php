<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Legacy flat-body wire shape still accepted by the live engine on
 * /v1/prequalify and /v1/quote while typed SDK envelopes roll out.
 */
final class LegacyWire
{
    public static function enabled(): bool
    {
        return getenv('ZYINS_LEGACY_WIRE') === '1';
    }

    /**
     * @return array<string,mixed>
     */
    public static function prequalifyBodyFromApplicant(Applicant $applicant, int $faceValue): array
    {
        $body = self::engineBodyFromApplicant($applicant);
        $body['quote_options'] = [
            'quote_type' => 'face_amounts',
            'amounts' => [(string) $faceValue],
        ];

        return $body;
    }

    /**
     * @return array<string,mixed>
     */
    public static function quoteBodyFromApplicant(Applicant $applicant, int $faceValue): array
    {
        $body = self::engineBodyFromApplicant($applicant);
        $body['quote_options'] = [
            'face_amounts' => [$faceValue],
            'pricing_modes' => ['MONTHLY-EFT'],
        ];

        return $body;
    }

    /**
     * @return array<string,mixed>
     */
    private static function engineBodyFromApplicant(Applicant $applicant): array
    {
        $body = [
            'date_of_birth' => $applicant->dob,
            'gender' => $applicant->sex === Sex::Female ? 'female' : 'male',
            'state' => $applicant->state,
            'height' => $applicant->height->totalInches,
            'weight' => $applicant->weight->pounds,
            'nicotine_usage' => [
                'is_nicotine_user' => self::isCurrentNicotineUser($applicant),
            ],
        ];
        if ($applicant->conditions !== []) {
            $body['conditions'] = array_map(
                static fn (Condition $c): array => [
                    'name' => $c->name,
                    'was_diagnosed' => $c->wasDiagnosed,
                    'last_treatment' => $c->lastTreatment,
                ],
                $applicant->conditions,
            );
        }
        if ($applicant->medications !== []) {
            $body['medications'] = array_map(
                static fn (Medication $m): array => [
                    'name' => $m->name,
                    'use' => $m->use,
                    'first_fill' => $m->firstFill,
                    'last_fill' => $m->lastFill,
                ],
                $applicant->medications,
            );
        }
        return $body;
    }

    public static function faceAmountFromCoverage(Coverage $coverage): int
    {
        return $coverage->type === 'face_value' && $coverage->amount > 0
            ? $coverage->amount
            : 25_000;
    }

    private static function isCurrentNicotineUser(Applicant $applicant): bool
    {
        $nicotineUse = $applicant->nicotineUse;
        if ($nicotineUse instanceof NicotineUsageInput) {
            return $nicotineUse->lastUsed === NicotineDuration::Within12Months;
        }

        return $nicotineUse === NicotineUsage::Current;
    }
}
