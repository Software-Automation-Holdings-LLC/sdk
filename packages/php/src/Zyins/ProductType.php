<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Coarse product type, mirroring the JS `ProductType` enum.
 */
enum ProductType: string
{
    case FinalExpense = 'final_expense';
    case Term = 'term';
    case WholeLife = 'whole_life';
    case MedicareSupplement = 'medicare_supplement';
    case Universal = 'universal';
    case Indexed = 'indexed';
}
