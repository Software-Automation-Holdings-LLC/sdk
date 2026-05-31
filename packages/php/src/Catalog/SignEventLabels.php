<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 */
final class SignEventLabels
{
    /** @return array<string,string> */
    public static function all(): array
    {
        return [
            'document.signed' => 'DocumentSigned',
        ];
    }

    public static function for(SignEvent $event): string
    {
        return self::all()[$event->value]
            ?? throw new \LogicException(sprintf('No label registered for %s', $event->value));
    }
}
