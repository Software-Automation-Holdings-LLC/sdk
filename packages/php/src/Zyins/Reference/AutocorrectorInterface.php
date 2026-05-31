<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Pluggable text autocorrection adapter.
 *
 * Replaces typos in free-text input using a consumer-supplied typo map.
 * `mode` governs the typing-state heuristics:
 *
 *  - {@see self::MODE_KEYUP}  — running per-keystroke; the autocorrector
 *    must not "complete" a partial word the user is still typing
 *    (e.g. `ASTHM` → `ASTHMA`).
 *  - {@see self::MODE_SUBMIT} — running on submit / blur; the
 *    autocorrector must not duplicate an already-present phrase
 *    (e.g. `HIGH CHOLESTEROL` → `HIGH HIGH CHOLESTEROL`).
 *
 * Implement this interface to plug a custom autocorrector (e.g. a
 * language-aware model) without touching the rest of the SDK. The default
 * {@see DefaultAutocorrector} ports the bpp2.0 algorithm line-for-line.
 *
 * @example
 *  $isa = Isa::withKeycode(autocorrector: new MyCustomAutocorrector());
 *  $clean = $isa->zyins->autocorrector->correct('hbp', mode: AutocorrectorInterface::MODE_SUBMIT);
 */
interface AutocorrectorInterface
{
    /** Running while the user is still typing. */
    public const MODE_KEYUP = 'keyup';

    /** Running on submit / blur — input is considered "final". */
    public const MODE_SUBMIT = 'submit';

    /**
     * Apply typo corrections to free-text input.
     *
     * @param self::MODE_* $mode Typing-state heuristic.
     */
    public function correct(string $text, string $mode = self::MODE_SUBMIT): string;
}
