<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Nicotine usage tri-state. The wire format negotiates between a
 * legacy boolean and the modern tri-state; the prequalify request is
 * the only place that picks the on-the-wire shape.
 */
enum NicotineUsage: string
{
    case None = 'none';
    case Current = 'current';
    case Former = 'former';
}
