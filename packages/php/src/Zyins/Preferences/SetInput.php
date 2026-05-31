<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Preferences;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::set()}. Carries the opaque
 * preferences document the server stores verbatim.
 */
final readonly class SetInput
{
    /**
     * @param array<string,mixed> $prefs Opaque preferences document. Required.
     */
    public function __construct(public array $prefs)
    {
        if ($prefs === []) {
            // Empty object is valid; null is not — typed array param
            // rejects null at the language level, but defend against
            // callers building the dict dynamically.
            return;
        }
    }

    /**
     * @return array<string,mixed>
     */
    public function toWireBody(): array
    {
        return ['prefs' => $this->prefs];
    }
}
