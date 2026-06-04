<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\DamerauOsa;
use Isa\Sdk\Zyins\Reference\Internal\DoubleMetaphone;

/**
 * Default text → ranked {@see Suggestion}[] algorithm — semantic port
 * of `src/sah-ui/Input/TextField/useAutocomplete.js` in bpp2.0.
 *
 * The query is first hard-filtered to plausible candidates (single-word
 * queries match on the make_key form — uppercase, all non-alphanumeric
 * stripped — so `crohns` reaches `Crohn's Disease`; multi-word queries
 * keep candidates missing at most one input word). Survivors are then
 * categorized into buckets, highest → lowest priority:
 *  1. {@see SuggestionBucket::STARTS_WITH} — sub-sort by option word count asc.
 *  2. {@see SuggestionBucket::SAME_WORDS} — identical word set + count.
 *  3. {@see SuggestionBucket::WORD_COUNT_NO_TOLERANCE} — option contains
 *     every input word + d extras; sub-sort by d asc.
 *  4. {@see SuggestionBucket::INDEPENDENT_WORD_INTERSECTION} — every
 *     input word appears in option.
 *  5. {@see SuggestionBucket::SAME_NUM_WITH_TOLERANCE} — same word count,
 *     different word sets.
 *  6. {@see SuggestionBucket::WORD_COUNT_WITH_TOLERANCE} — d words
 *     differ/extra; sub-sort by d asc.
 *  7. {@see SuggestionBucket::FUZZY} — typo-recovery hits; ranks last.
 *
 * Within-bucket frequency boost:
 *  - `scaleFactor = max(1, totalGroups - groupIndex)`
 *  - `score = (frequencies[id] + 1) * scaleFactor`
 *  - Sort desc by score; ties alphabetical asc.
 *  - Skip frequency sort entirely if no candidate has a frequency entry.
 *
 * Honors {@see AutocompleteOptions::$limit} and `$kinds`. Returns `[]`
 * on no candidates and on empty query.
 */
final class DefaultAutocompleteAlgorithm implements AutocompleteAlgorithmInterface
{
    /**
     * Substring-hit count at or below which the typo-tolerant fallback fires.
     * A typo-recovery pass only earns its keep when literal matching comes up
     * nearly empty.
     */
    private const FUZZY_FALLBACK_THRESHOLD = 1;

    /**
     * Edit-distance ceiling for the autocomplete fuzzy band, one wider than
     * the {@see FuzzyMatchAlgorithm} single-result band in the medium range:
     * autocomplete shows a ranked list with fuzzy hits in the strict lowest
     * bucket, so a slightly looser net is safe and catches double-edit
     * transpositions the match path rejects (`chrons` → `crohns` is OSA
     * distance 2).
     */
    private const AUTOCOMPLETE_FUZZY_MAX_DISTANCE = 2;

    /**
     * @param bool $fuzzy When true (default), a query the substring filter
     *                     cannot place falls back to a token-aware fuzzy pass.
     *                     Pass false to restore substring-only behaviour.
     */
    public function __construct(
        public readonly ?string $versionTag = null,
        public readonly bool $fuzzy = true,
    ) {
    }

    public function rank(string $query, array $candidates, AutocompleteOptions $options): array
    {
        $trimmed = trim($query);
        if ($trimmed === '' || $candidates === []) {
            return [];
        }

        $filteredKinds = $options->kinds;
        if ($filteredKinds !== []) {
            $candidates = array_values(array_filter(
                $candidates,
                static fn (ConceptInterface $c): bool => in_array($c->kind(), $filteredKinds, true),
            ));
            if ($candidates === []) {
                return [];
            }
        }

        $wordsInInput = self::tokenize($trimmed);
        $upperInput = strtoupper($trimmed);
        // make_key form: uppercase, strip ALL non-alphanumeric — what the
        // engine matches on server-side, so a correctly-spelled `crohns`
        // reaches `Crohn's Disease`.
        $queryKey = MakeKey::normalize($query);

        // 1. Hard pre-filter to plausible candidates (mirrors the JS worker).
        $filtered = self::prefilter($candidates, $wordsInInput, $queryKey);

        // 1b. Typo-tolerant fallback. When the literal filter comes up nearly
        // empty, recover transpositions/phonetic misses (`chrons` → Crohn's,
        // `diabetis` → Diabetes, `tylonol` → Tylenol). Default ON; the
        // `fuzzy: false` opt-out skips it.
        $fuzzyMatches = [];
        if ($this->fuzzy && count($filtered) <= self::FUZZY_FALLBACK_THRESHOLD) {
            $fuzzyMatches = self::collectFuzzy($queryKey, $wordsInInput, $candidates, $filtered);
        }

        if ($filtered === [] && $fuzzyMatches === []) {
            return [];
        }

        // 2. Bucket the literal survivors.
        $startsWith = [];
        $sameWords = [];
        $independentWordIntersection = [];
        /** @var array<int,list<ConceptInterface>> $wordCountNoTolerance */
        $wordCountNoTolerance = [];
        $sameNumWithTolerance = [];
        /** @var array<int,list<ConceptInterface>> $wordCountWithTolerance */
        $wordCountWithTolerance = [];

        $cleanedInput = str_replace('(', '', $upperInput);
        foreach ($filtered as $option) {
            $name = $option->name();
            $cleaned = str_replace('(', '', $name);
            $cleanedUpper = strtoupper($cleaned);
            $wordsInOption = self::tokenize($cleaned);
            $isStartMatch = str_starts_with($cleanedUpper, $cleanedInput);
            $isSameLength = count($wordsInOption) === count($wordsInInput);
            $lengthDiff = abs(count($wordsInInput) - count($wordsInOption));
            $optionSet = array_flip($wordsInOption);
            $inputSet = array_flip($wordsInInput);
            $supersetOfInput = true;
            foreach ($wordsInInput as $w) {
                if (! isset($optionSet[$w])) {
                    $supersetOfInput = false;
                    break;
                }
            }
            $allWordsAppear = true;
            foreach ($wordsInInput as $w) {
                if (! str_contains($cleanedUpper, $w)) {
                    $allWordsAppear = false;
                    break;
                }
            }

            if ($isStartMatch) {
                $startsWith[] = $option;
            } elseif ($isSameLength && count($inputSet) === count($optionSet) && self::setEquals($inputSet, $optionSet)) {
                $sameWords[] = $option;
            } elseif (! $supersetOfInput && $allWordsAppear) {
                $independentWordIntersection[] = $option;
            } elseif ($supersetOfInput) {
                $wordCountNoTolerance[$lengthDiff] ??= [];
                $wordCountNoTolerance[$lengthDiff][] = $option;
            } elseif ($isSameLength) {
                $sameNumWithTolerance[] = $option;
            } else {
                $wordCountWithTolerance[$lengthDiff] ??= [];
                $wordCountWithTolerance[$lengthDiff][] = $option;
            }
        }

        // Sub-sort startsWith by ascending word count of the option name.
        usort($startsWith, static function (ConceptInterface $a, ConceptInterface $b): int {
            return count(self::tokenize($a->name())) <=> count(self::tokenize($b->name()));
        });

        ksort($wordCountNoTolerance);
        ksort($wordCountWithTolerance);

        /** @var list<array{bucket:string,items:list<ConceptInterface>}> $groups */
        $groups = [
            ['bucket' => SuggestionBucket::STARTS_WITH, 'items' => $startsWith],
            ['bucket' => SuggestionBucket::SAME_WORDS, 'items' => $sameWords],
            // independentWordIntersection ranks ABOVE wordCountNoTolerance —
            // mirrors the canonical TS/JS reference (and the Go/Python ports).
            ['bucket' => SuggestionBucket::INDEPENDENT_WORD_INTERSECTION, 'items' => $independentWordIntersection],
            ['bucket' => SuggestionBucket::WORD_COUNT_NO_TOLERANCE, 'items' => array_merge(...array_values($wordCountNoTolerance) ?: [[]])],
            ['bucket' => SuggestionBucket::SAME_NUM_WITH_TOLERANCE, 'items' => $sameNumWithTolerance],
            ['bucket' => SuggestionBucket::WORD_COUNT_WITH_TOLERANCE, 'items' => array_merge(...array_values($wordCountWithTolerance) ?: [[]])],
            // Fuzzy hits occupy the strict lowest bucket — always below every
            // literal (exact / prefix / substring / word-tolerance) match.
            ['bucket' => SuggestionBucket::FUZZY, 'items' => $fuzzyMatches],
        ];

        if ($options->sort === Sort::ALPHABETICAL) {
            return self::flattenAlphabetical($groups, $options);
        }

        return self::flattenWithFrequencyBoost($groups, $options);
    }

    /**
     * Hard pre-filter to plausible candidates. A single-word query matches a
     * candidate when its make_key form is a substring of the candidate's
     * make_key form; a multi-word query keeps candidates missing at most one
     * input word. Mirrors the TS/Go/Python/C# reference filters.
     *
     * @param list<ConceptInterface> $candidates
     * @param list<string>           $wordsInInput
     * @return list<ConceptInterface>
     */
    private static function prefilter(array $candidates, array $wordsInInput, string $queryKey): array
    {
        $out = [];
        foreach ($candidates as $option) {
            if (count($wordsInInput) < 2) {
                if ($queryKey !== '' && str_contains(MakeKey::normalize($option->name()), $queryKey)) {
                    $out[] = $option;
                }
                continue;
            }
            $optionSet = array_flip(self::tokenize($option->name()));
            $missing = 0;
            foreach ($wordsInInput as $w) {
                if (! isset($optionSet[$w])) {
                    $missing++;
                }
            }
            if ($missing <= 1) {
                $out[] = $option;
            }
        }
        return $out;
    }

    /**
     * Recover typo'd queries the literal pre-filter could not place. For each
     * candidate not already matched, accept it when any candidate token
     * fuzzy-matches the query — Damerau-OSA within the length band OR
     * Double-Metaphone primary-code equality. Per-token matching keeps a short
     * query (`chrons`) from being swamped by the edit distance of a long name.
     * Reuses the same primitives as {@see FuzzyMatchAlgorithm} for
     * cross-language parity.
     *
     * @param list<ConceptInterface> $candidates
     * @param list<string>           $wordsInInput
     * @param list<ConceptInterface> $alreadyMatched
     * @return list<ConceptInterface>
     */
    private static function collectFuzzy(string $queryKey, array $wordsInInput, array $candidates, array $alreadyMatched): array
    {
        if ($queryKey === '') {
            return [];
        }
        $matched = [];
        foreach ($alreadyMatched as $c) {
            $matched[$c->id() ?? $c->name()] = true;
        }
        $queryUnits = count($wordsInInput) > 1 ? $wordsInInput : [$queryKey];
        $queryCodes = array_map(static fn (string $u): string => DoubleMetaphone::encode($u)[0], $queryUnits);
        $hits = [];
        foreach ($candidates as $option) {
            if (isset($matched[$option->id() ?? $option->name()])) {
                continue;
            }
            if (self::fuzzyMatchesAnyToken($queryUnits, $queryCodes, self::tokenize($option->name()))) {
                $hits[] = $option;
            }
        }
        return $hits;
    }

    /**
     * @param list<string> $queryUnits
     * @param list<string> $queryCodes
     * @param list<string> $candidateTokens
     */
    private static function fuzzyMatchesAnyToken(array $queryUnits, array $queryCodes, array $candidateTokens): bool
    {
        foreach ($queryUnits as $i => $unit) {
            if ($unit === '') {
                continue;
            }
            $threshold = strlen($unit) < DamerauOsa::FUZZY_SHORT_LEN ? 1 : self::AUTOCOMPLETE_FUZZY_MAX_DISTANCE;
            $code = $queryCodes[$i];
            foreach ($candidateTokens as $token) {
                if ($token === '') {
                    continue;
                }
                if (DamerauOsa::distance($unit, $token, $threshold) <= $threshold) {
                    return true;
                }
                if ($code !== '' && DoubleMetaphone::encode($token)[0] === $code) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Collapse every relevance bucket into one case-insensitive A→Z list.
     * The relevance filter already chose membership; ALPHABETICAL only
     * changes ordering. De-dupes by id (first occurrence wins before the
     * sort); ties break by case-sensitive name then id for stable,
     * cross-language output.
     *
     * @param list<array{bucket:string,items:list<ConceptInterface>}> $groups
     * @return list<Suggestion>
     */
    private static function flattenAlphabetical(array $groups, AutocompleteOptions $options): array
    {
        $seen = [];
        /** @var list<array{concept:ConceptInterface,bucket:string}> $rows */
        $rows = [];
        foreach ($groups as $group) {
            foreach ($group['items'] as $opt) {
                $key = $opt->id() ?? $opt->name();
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $rows[] = ['concept' => $opt, 'bucket' => $group['bucket']];
            }
        }
        usort($rows, static function (array $a, array $b): int {
            $an = strtolower($a['concept']->name());
            $bn = strtolower($b['concept']->name());
            if ($an !== $bn) {
                return $an <=> $bn;
            }
            $byName = strcmp($a['concept']->name(), $b['concept']->name());
            if ($byName !== 0) {
                return $byName;
            }
            return strcmp((string) $a['concept']->id(), (string) $b['concept']->id());
        });

        // ALPHABETICAL collapses every bucket into one group, so the
        // frequency-boost scaleFactor is max(1, 1 - 0) = 1 and each
        // suggestion carries score = (frequency + 1). This matches the
        // TS/Python mirrors, which run computeScoreLookup unconditionally
        // after the sort decision so consumers comparing `score` see the
        // catalog frequency signal even in alphabetical order.
        $freqs = $options->frequencies;
        $out = [];
        foreach ($rows as $row) {
            $id = $row['concept']->id();
            $score = (($id !== null ? ($freqs[$id] ?? 0) : 0) + 1);
            $out[] = new Suggestion(
                concept: $row['concept'],
                bucket: $row['bucket'],
                score: $score,
            );
            if ($options->limit > 0 && count($out) >= $options->limit) {
                return $out;
            }
        }
        return $out;
    }

    /**
     * @param list<array{bucket:string,items:list<ConceptInterface>}> $groups
     * @return list<Suggestion>
     */
    private static function flattenWithFrequencyBoost(array $groups, AutocompleteOptions $options): array
    {
        $totalGroups = count($groups);
        $freqs = $options->frequencies;

        $anyFrequency = false;
        if ($freqs !== []) {
            foreach ($groups as $group) {
                foreach ($group['items'] as $opt) {
                    $id = $opt->id();
                    if ($id !== null && isset($freqs[$id])) {
                        $anyFrequency = true;
                        break 2;
                    }
                }
            }
        }

        $seen = [];
        $out = [];
        foreach ($groups as $groupIndex => $group) {
            $scaleFactor = max(1, $totalGroups - $groupIndex);
            /** @var list<array{concept:ConceptInterface,score:int}> $rows */
            $rows = [];
            foreach ($group['items'] as $opt) {
                $id = $opt->id() ?? $opt->name();
                if (isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = true;
                $rawFreq = ($opt->id() !== null ? ($freqs[$opt->id()] ?? 0) : 0) + 1;
                $rows[] = ['concept' => $opt, 'score' => $rawFreq * $scaleFactor];
            }
            if ($anyFrequency && $rows !== []) {
                usort($rows, static function (array $a, array $b): int {
                    if ($a['score'] !== $b['score']) {
                        return $b['score'] <=> $a['score'];
                    }
                    return strcmp($a['concept']->name(), $b['concept']->name());
                });
            }
            foreach ($rows as $row) {
                $out[] = new Suggestion(
                    concept: $row['concept'],
                    bucket: $group['bucket'],
                    score: $row['score'],
                );
                if ($options->limit > 0 && count($out) >= $options->limit) {
                    return $out;
                }
            }
        }
        return $out;
    }

    /** @return list<string> */
    private static function tokenize(string $text): array
    {
        $upper = strtoupper($text);
        $parts = preg_split('/\s+/', $upper) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $stripped = preg_replace('/[^A-Z0-9]/', '', $part) ?? '';
            if ($stripped !== '') {
                $out[] = $stripped;
            }
        }
        return $out;
    }

    /**
     * @param array<string,int> $a
     * @param array<string,int> $b
     */
    private static function setEquals(array $a, array $b): bool
    {
        foreach (array_keys($a) as $k) {
            if (! isset($b[$k])) {
                return false;
            }
        }
        return true;
    }

    public function clone(?string $versionTag = null, ?bool $fuzzy = null): self
    {
        return new self(
            versionTag: $versionTag ?? $this->versionTag,
            fuzzy: $fuzzy ?? $this->fuzzy,
        );
    }
}
