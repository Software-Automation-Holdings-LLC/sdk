<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Preferences;

/**
 * Typed response for {@see Service::lookup()} and {@see Service::set()}.
 *
 * Carries the opaque preferences document. The SDK does not interpret
 * the document — callers cast through to their own settings shape.
 */
final readonly class PreferencesResult
{
    /**
     * @param array<string,mixed> $prefs
     */
    public function __construct(public array $prefs)
    {
    }

    /**
     * @param array<string,mixed>      $data
     * @param array<string,mixed>|null $fallback Used when the server returns an empty body on POST success.
     */
    public static function fromWire(array $data, ?array $fallback = null): self
    {
        if ($data === []) {
            return new self($fallback ?? []);
        }
        if (isset($data['prefs']) && is_array($data['prefs'])) {
            /** @var array<string,mixed> $prefs */
            $prefs = $data['prefs'];
            return new self($prefs);
        }
        // The transport's envelope unwrap already returned the inner
        // body, so a bare object IS the prefs document.
        return new self($data);
    }
}
