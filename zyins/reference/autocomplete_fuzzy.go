package reference

import "context"

// fuzzyFallbackThreshold is the substring-hit count at or below which the
// typo-tolerant fallback fires. Mirrors the TS reference: a typo-recovery
// pass only earns its keep when literal matching comes up nearly empty.
const fuzzyFallbackThreshold = 1

// autocompleteFuzzyThreshold is the edit-distance ceiling for the
// autocomplete fuzzy band, by query-unit length. One wider than the
// FuzzyMatchAlgorithm single-result band in the medium range: autocomplete
// shows a RANKED list with fuzzy hits in the strict lowest bucket, so a
// slightly looser net is safe and catches double-edit transpositions the
// match path rejects ("chrons" → "crohns" is OSA distance 2).
func autocompleteFuzzyThreshold(unitLength int) int {
	if unitLength < fuzzyShortLen {
		return 1
	}
	return maxEditDistance
}

// collectFuzzyAutocomplete recovers typo'd queries. For each kind-filtered
// candidate not already placed by the literal prefilter, the query matches
// when ANY candidate token clears the bar against the corresponding query
// unit — Damerau-OSA within the length band OR Double-Metaphone equality.
// Per-token matching keeps a short query ("chrons") from being swamped by the
// edit distance of a long name ("CROHNSDISEASE"). Reuses the same primitives
// as FuzzyMatchAlgorithm for cross-language parity. Stops between candidates
// once ctx is done; the caller discards the partial result.
func collectFuzzyAutocomplete(ctx context.Context, queryKey string, wordsInInput []string, candidates, alreadyMatched []CandidateConcept) []CandidateConcept {
	if len(queryKey) == 0 {
		return nil
	}
	matched := make(map[string]struct{}, len(alreadyMatched))
	for _, c := range alreadyMatched {
		matched[autocompleteScoreKey(c)] = struct{}{}
	}
	queryUnits := wordsInInput
	if len(wordsInInput) <= 1 {
		queryUnits = []string{queryKey}
	}
	queryCodes := make(map[string]struct{}, len(queryUnits))
	for _, u := range queryUnits {
		if code := doubleMetaphone(u).primary; code != "" {
			queryCodes[code] = struct{}{}
		}
	}
	out := make([]CandidateConcept, 0)
	for _, c := range candidates {
		if ctx.Err() != nil {
			return nil
		}
		if _, ok := matched[autocompleteScoreKey(c)]; ok {
			continue
		}
		if fuzzyMatchesAnyToken(queryUnits, queryCodes, tokenizeAutocomplete(c.Name)) {
			out = append(out, c)
		}
	}
	return out
}

// fuzzyMatchesAnyToken encodes each candidate token once and tests it against
// the whole query-code set, so phonetic work scales with candidate tokens,
// not candidate tokens × query units.
func fuzzyMatchesAnyToken(queryUnits []string, queryCodes map[string]struct{}, candidateTokens []string) bool {
	for _, token := range candidateTokens {
		for _, unit := range queryUnits {
			threshold := autocompleteFuzzyThreshold(len(unit))
			if optimalStringAlignmentDistance(unit, token, threshold) <= threshold {
				return true
			}
		}
		if len(queryCodes) == 0 {
			continue
		}
		if _, ok := queryCodes[doubleMetaphone(token).primary]; ok {
			return true
		}
	}
	return false
}
