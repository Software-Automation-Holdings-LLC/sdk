<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Wire discriminator for the `quote_options.quote_type` field.
 *
 * Values mirror the server's `QuoteType` enum exactly.
 */
enum QuoteType: string
{
    case FaceAmounts   = 'face_amounts';
    case MonthlyBudget = 'monthly_budget';
}
