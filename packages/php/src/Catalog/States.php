<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Catalog API for {@see State}. Provides `values()`, `metadata()`, and
 * `byAbbreviation()` lookups in parity with the TS SDK's `States`
 * facade.
 */
final class States
{
    /** @return list<State> */
    public static function values(): array
    {
        return State::cases();
    }

    public static function metadata(State $state): StateMetadata
    {
        return self::metadataMap()[$state->value];
    }

    /**
     * Look up a state by its ISO abbreviation (case-insensitive) or by
     * its full English name (case-insensitive). Returns `null` for
     * unknown input.
     */
    public static function byAbbreviation(string $input): ?State
    {
        $upper = strtoupper(trim($input));
        $state = State::tryFrom($upper);
        if ($state !== null) {
            return $state;
        }
        $lower = strtolower(trim($input));
        $abbr = self::nameMap()[$lower] ?? null;
        return $abbr === null ? null : State::tryFrom($abbr);
    }

    /** @return array<string,StateMetadata> */
    private static function metadataMap(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        $rows = [
            ['AL', 'Alabama', false], ['AK', 'Alaska', false], ['AZ', 'Arizona', false],
            ['AR', 'Arkansas', false], ['CA', 'California', false], ['CO', 'Colorado', false],
            ['CT', 'Connecticut', false], ['DE', 'Delaware', false], ['FL', 'Florida', false],
            ['GA', 'Georgia', false], ['HI', 'Hawaii', false], ['ID', 'Idaho', false],
            ['IL', 'Illinois', false], ['IN', 'Indiana', false], ['IA', 'Iowa', false],
            ['KS', 'Kansas', false], ['KY', 'Kentucky', false], ['LA', 'Louisiana', false],
            ['ME', 'Maine', false], ['MD', 'Maryland', false], ['MA', 'Massachusetts', false],
            ['MI', 'Michigan', false], ['MN', 'Minnesota', false], ['MS', 'Mississippi', false],
            ['MO', 'Missouri', false], ['MT', 'Montana', false], ['NE', 'Nebraska', false],
            ['NV', 'Nevada', false], ['NH', 'New Hampshire', false], ['NJ', 'New Jersey', false],
            ['NM', 'New Mexico', false], ['NY', 'New York', false], ['NC', 'North Carolina', false],
            ['ND', 'North Dakota', false], ['OH', 'Ohio', false], ['OK', 'Oklahoma', false],
            ['OR', 'Oregon', false], ['PA', 'Pennsylvania', false], ['RI', 'Rhode Island', false],
            ['SC', 'South Carolina', false], ['SD', 'South Dakota', false], ['TN', 'Tennessee', false],
            ['TX', 'Texas', false], ['UT', 'Utah', false], ['VT', 'Vermont', false],
            ['VA', 'Virginia', false], ['WA', 'Washington', false], ['WV', 'West Virginia', false],
            ['WI', 'Wisconsin', false], ['WY', 'Wyoming', false], ['DC', 'District of Columbia', false],
            ['AS', 'American Samoa', true], ['GU', 'Guam', true],
            ['MP', 'Northern Mariana Islands', true], ['PR', 'Puerto Rico', true],
            ['VI', 'United States Virgin Islands', true],
        ];
        $out = [];
        foreach ($rows as [$abbr, $name, $terr]) {
            $out[$abbr] = new StateMetadata(abbreviation: $abbr, name: $name, isTerritory: $terr);
        }
        $cache = $out;
        return $cache;
    }

    /** @return array<string,string> */
    private static function nameMap(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        $out = [];
        foreach (self::metadataMap() as $abbr => $meta) {
            $out[strtolower($meta->name)] = $abbr;
        }
        $cache = $out;
        return $cache;
    }
}
