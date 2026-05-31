<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Closed enum of dataset categories surfaced by `GET /v3/datasets`.
 * Adding a category is a server + spec + SDK change; the closed enum
 * is intentional so consumers cannot pass a typo through to the wire.
 */
enum DatasetCategory: string
{
    case Medications = 'medications';
    case Conditions = 'conditions';
    case Products = 'products';
    case NicotineOptions = 'nicotine_options';
    case SpellingCorrections = 'spelling_corrections';
}
