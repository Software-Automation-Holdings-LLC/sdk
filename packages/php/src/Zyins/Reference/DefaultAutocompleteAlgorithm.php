<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Default text → ranked {@see Suggestion}[] algorithm — semantic port
 * of `src/sah-ui/Input/TextField/useAutocomplete.js` in bpp2.0.
 *
 * Buckets, highest → lowest priority:
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
    public function __construct(public readonly ?string $versionTag = null)
    {
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

        // 6 buckets keyed by SuggestionBucket constants. word-count
        // buckets group rows by length-diff, flattened in ascending order.
        $startsWith = [];
        $sameWords = [];
        $independentWordIntersection = [];
        /** @var array<int,list<ConceptInterface>> $wordCountNoTolerance */
        $wordCountNoTolerance = [];
        $sameNumWithTolerance = [];
        /** @var array<int,list<ConceptInterface>> $wordCountWithTolerance */
        $wordCountWithTolerance = [];

        foreach ($candidates as $option) {
            $name = $option->name();
            $cleaned = str_replace('(', '', $name);
            $wordsInOption = self::tokenize($cleaned);
            $isStartMatch = str_starts_with(strtoupper($cleaned), str_replace('(', '', $upperInput));
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

            if ($isStartMatch) {
                $startsWith[] = $option;
            } elseif ($isSameLength) {
                if (count($inputSet) === count($optionSet) && self::setEquals($inputSet, $optionSet)) {
                    $sameWords[] = $option;
                } else {
                    $sameNumWithTolerance[] = $option;
                }
            } else {
                if ($supersetOfInput) {
                    $wordCountNoTolerance[$lengthDiff] ??= [];
                    $wordCountNoTolerance[$lengthDiff][] = $option;
                } else {
                    $wordCountWithTolerance[$lengthDiff] ??= [];
                    $wordCountWithTolerance[$lengthDiff][] = $option;
                }
            }

            $allWordsAppear = true;
            foreach ($wordsInInput as $w) {
                if (! str_contains($cleaned, $w)) {
                    $allWordsAppear = false;
                    break;
                }
            }
            if ($allWordsAppear) {
                $independentWordIntersection[] = $option;
            }
        }

        // Sub-sort startsWith by ascending word count of the option name.
        usort($startsWith, static function (ConceptInterface $a, ConceptInterface $b): int {
            return count(preg_split('/\s+/', trim($a->name())) ?: [])
                <=> count(preg_split('/\s+/', trim($b->name())) ?: []);
        });

        ksort($wordCountNoTolerance);
        ksort($wordCountWithTolerance);

        /** @var list<array{bucket:string,items:list<ConceptInterface>}> $groups */
        $groups = [
            ['bucket' => SuggestionBucket::STARTS_WITH, 'items' => $startsWith],
            ['bucket' => SuggestionBucket::SAME_WORDS, 'items' => $sameWords],
            ['bucket' => SuggestionBucket::WORD_COUNT_NO_TOLERANCE, 'items' => array_merge(...array_values($wordCountNoTolerance) ?: [[]])],
            ['bucket' => SuggestionBucket::INDEPENDENT_WORD_INTERSECTION, 'items' => $independentWordIntersection],
            ['bucket' => SuggestionBucket::SAME_NUM_WITH_TOLERANCE, 'items' => $sameNumWithTolerance],
            ['bucket' => SuggestionBucket::WORD_COUNT_WITH_TOLERANCE, 'items' => array_merge(...array_values($wordCountWithTolerance) ?: [[]])],
        ];

        if ($options->sort === Sort::ALPHABETICAL) {
            return self::flattenAlphabetical($groups, $options);
        }

        return self::flattenWithFrequencyBoost($groups, $options);
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

    public function clone(?string $versionTag = null): self
    {
        return new self(versionTag: $versionTag ?? $this->versionTag);
    }
}
