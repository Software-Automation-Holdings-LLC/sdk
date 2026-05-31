<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Default autocorrector — line-for-line port of
 * `src/sah-ui/Input/TextField/useAutocorrect.js` in bpp2.0.
 *
 * Algorithm:
 *  1. Tokenize input on whitespace; uppercase.
 *  2. For window size 1..wordCount, slide every contiguous n-gram of
 *     input words.
 *  3. For each n-gram, lookup in `typoMap`.
 *  4. Skip on the typing-state guard:
 *     - {@see AutocorrectorInterface::MODE_KEYUP}: skip if
 *       `correction.includes(input) && correction.length > input.length`
 *       — protects mid-typing (`ASTHM` → `ASTHMA`).
 *     - {@see AutocorrectorInterface::MODE_SUBMIT}: skip if
 *       `input.includes(correction)` — anti-duplication
 *       (`HIGH CHOLESTEROL` → `HIGH HIGH CHOLESTEROL`).
 *  5. On match, replace `input[i..i+windowSize]` with the correction;
 *     mark positions as processed; skip ahead.
 *  6. Preserve trailing whitespace.
 *  7. Reassemble with single-space separator.
 *
 * Bound by {@see Isa::autocorrector()} or the `autocorrector`
 * constructor parameter on {@see \Isa\Sdk\Isa}.
 *
 * @example
 *  $typoMap = ['HBP' => 'HIGH BLOOD PRESSURE'];
 *  $ac = Isa::autocorrector()->create($typoMap);
 *  echo $ac->correct('hbp');                                       // "HIGH BLOOD PRESSURE"
 *  echo $ac->correct('asthm', AutocorrectorInterface::MODE_KEYUP); // "ASTHM"
 */
final class DefaultAutocorrector implements AutocorrectorInterface
{
    /**
     * Optional callback fired on every successful correction; receives
     * an event payload describing the swap. `null` by default.
     *
     * @var (\Closure(AutocorrectEvent):void)|null
     */
    private readonly ?\Closure $onApplied;

    /**
     * @param array<string,string> $typoMap   Map of uppercase typo → uppercase correction.
     * @param string|null          $versionTag Optional opaque tag describing the typo map (e.g. dataset version).
     * @param (\Closure(AutocorrectEvent):void)|null $onApplied
     */
    public function __construct(
        public readonly array $typoMap,
        public readonly ?string $versionTag = null,
        ?\Closure $onApplied = null,
    ) {
        $this->onApplied = $onApplied;
    }

    public function correct(string $text, string $mode = AutocorrectorInterface::MODE_SUBMIT): string
    {
        if ($text === '' || $this->typoMap === []) {
            return $text;
        }
        $basedOnKeyup = $mode === AutocorrectorInterface::MODE_KEYUP;

        $trailingWhitespace = str_ends_with($text, ' ') ? ' ' : '';
        $upper = strtoupper($text);
        $words = preg_split('/\s+/', $upper) ?: [];
        /** @var list<string> $words */
        $words = array_values($words);
        $wordCount = count($words);

        $newArr = array_fill(0, $wordCount, null);
        /** @var array<int,true> $addedIndices */
        $addedIndices = [];

        for ($numWords = 0; $numWords < $wordCount; $numWords++) {
            for ($i = 0; $i < $wordCount; $i++) {
                $toAdd = array_slice($words, $i, $numWords + 1);
                $word = implode(' ', $toAdd);
                if (! isset($this->typoMap[$word])) {
                    continue;
                }
                $correction = $this->typoMap[$word];
                $shouldCorrect = $basedOnKeyup
                    ? ! (str_contains(strtoupper($correction), $word) && strlen($correction) > strlen($word))
                    : ! str_contains($upper, $correction);
                if (! $shouldCorrect) {
                    continue;
                }
                $newArr[$i] = $correction;
                for ($n = 0; $n <= $numWords; $n++) {
                    if ($i + $n < $wordCount) {
                        $addedIndices[$i + $n] = true;
                    }
                }
                if ($this->onApplied !== null) {
                    ($this->onApplied)(new AutocorrectEvent(from: $word, to: $correction, mode: $mode));
                }
                $numWords += count($toAdd) - 1;
                break;
            }
        }

        for ($i = 0; $i < $wordCount; $i++) {
            if ($newArr[$i] === null && ! isset($addedIndices[$i])) {
                $newArr[$i] = $words[$i];
            }
        }

        $filled = [];
        foreach ($newArr as $piece) {
            if ($piece !== null && $piece !== '') {
                $filled[] = $piece;
            }
        }
        return implode(' ', $filled) . $trailingWhitespace;
    }

    /**
     * Return a new instance with selected fields overridden. Mirrors the
     * `clone()` extension surface in the sibling SDKs.
     *
     * @param array<string,string>|null $typoMap
     * @param (\Closure(AutocorrectEvent):void)|null $onApplied
     */
    public function clone(
        ?array $typoMap = null,
        ?string $versionTag = null,
        ?\Closure $onApplied = null,
    ): self {
        return new self(
            typoMap: $typoMap ?? $this->typoMap,
            versionTag: $versionTag ?? $this->versionTag,
            onApplied: $onApplied ?? $this->onApplied,
        );
    }
}
