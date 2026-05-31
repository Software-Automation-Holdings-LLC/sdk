<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Title Case label derivation + plan-info wire coercion.
 *
 * Mirrors `packages/ts/src/zyins/planInfoLabel.ts` and
 * `packages/python/src/sah_sdk/zyins/plan_info_label.py` so consumers
 * reading any SDK see identical Title-Case behavior for plan-info keys.
 *
 * The post-zyins#349 wire shape carries a server-emitted `label` per
 * item — used verbatim. For pre-#349 bodies (legacy
 * `array<string, list<string>>` shape) the SDK upconverts to the typed
 * array surface and synthesizes a label by Title-Casing the snake_case
 * key so downstream UIs see exactly one type during the migration window.
 *
 * Special-cases the canonical acronyms (eApp, URL, PDF, FAQ, API, ID,
 * EFT, ACH, SSN). All other tokens follow the generic "split on `_` /
 * `-`, capitalize each word" rule.
 */
final class PlanInfoLabel
{
    /**
     * Tokens whose canonical display form is NOT a simple capitalize.
     * The TS / Python / Go SDKs carry the identical set; keep them in
     * lock-step so a bug in one language translates to a bug in the
     * other.
     *
     * @var array<string, string>
     */
    private const SPECIAL_LABELS = [
        'eapp' => 'eApp',
        'url'  => 'URL',
        'pdf'  => 'PDF',
        'faq'  => 'FAQ',
        'api'  => 'API',
        'id'   => 'ID',
        'eft'  => 'EFT',
        'ach'  => 'ACH',
        'ssn'  => 'SSN',
    ];

    /**
     * Title-Case a snake_case / kebab-case plan-info key.
     *
     * Empty string in → empty string out. The server emits non-empty
     * keys in practice; the empty-string guard exists so this function
     * is safe to call on adversarial input from a malformed wire body.
     */
    public static function titleCase(string $key): string
    {
        if ($key === '') {
            return '';
        }
        $parts = preg_split('/[_\-]+/', $key, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $out = array_map(self::capitalizeWord(...), $parts);

        return implode(' ', $out);
    }

    private static function capitalizeWord(string $word): string
    {
        if ($word === '') {
            return '';
        }
        $lower = strtolower($word);

        return self::SPECIAL_LABELS[$lower] ?? ucfirst($lower);
    }

    /**
     * Coerce a wire `plan_info` field into the typed array surface.
     *
     * Accepts both wire shapes:
     *  - Post-zyins#349: `list<array{key:string,label?:string,values:list<string>}>` — used verbatim.
     *  - Pre-zyins#349: `array<string, list<string>>` — upconverted; labels are
     *    Title Cased from each key so consumers see one shape only.
     *
     * Returns `[]` on any unrecognized shape — lenient by design so a
     * forward-compatible field addition cannot break parsing.
     *
     * @return list<PlanInfoItem>
     */
    public static function coerce(mixed $raw): array
    {
        if (is_array($raw) && array_is_list($raw)) {
            return self::coerceTypedArray($raw);
        }
        if (is_array($raw)) {
            return self::coerceLegacyMap($raw);
        }

        return [];
    }

    /**
     * @param list<mixed> $entries
     * @return list<PlanInfoItem>
     */
    private static function coerceTypedArray(array $entries): array
    {
        $out = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $key = $entry['key'] ?? null;
            if (!is_string($key) || $key === '') {
                continue;
            }
            $labelRaw = $entry['label'] ?? null;
            $label = is_string($labelRaw) && $labelRaw !== ''
                ? $labelRaw
                : self::titleCase($key);
            $valuesRaw = $entry['values'] ?? [];
            $values = is_array($valuesRaw)
                ? array_values(array_filter($valuesRaw, 'is_string'))
                : [];
            $out[] = new PlanInfoItem($key, $label, $values);
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $map
     * @return list<PlanInfoItem>
     */
    private static function coerceLegacyMap(array $map): array
    {
        $out = [];
        foreach ($map as $key => $values) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            $valuesArray = is_array($values)
                ? array_values(array_filter($values, 'is_string'))
                : [];
            $out[] = new PlanInfoItem($key, self::titleCase($key), $valuesArray);
        }

        return $out;
    }
}
