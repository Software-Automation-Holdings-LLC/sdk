package reference

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"
)

// Sizes for the unbounded-fuzzy denial-of-service spec.
//
// A typeahead query is attacker-controlled free text. The default ranker
// tokenizes every word and, when the literal prefilter misses, compares
// each word with every token of every candidate — including a fresh
// Double Metaphone of the candidate token. Cost therefore grows with
// query words × catalog tokens, and Rank discards its context, so a
// caller timeout cannot stop a scan already in progress.
//
// The probe word is two letters that occur in none of the synthetic
// names, so every candidate misses the prefilter and the fuzzy fallback
// (on by default) scans the whole catalog. Limit is 1 because the limit
// only trims the returned slice, after that scan.
const (
	autocompleteDoSCatalogSize   = 1500
	autocompleteDoSBaselineWords = 4
	autocompleteDoSAttackWords   = 2500
	autocompleteDoSScale         = 5
	autocompleteDoSFloor         = 25 * time.Millisecond
	autocompleteDoSCancelAfter   = 40 * time.Millisecond
	autocompleteDoSCancelCeiling = 200 * time.Millisecond
)

func TestRank_LongUnmatchedQuery_StaysWithinBaseline(t *testing.T) {
	algo := NewDefaultAutocompleteAlgorithm()
	candidates := autocompleteDoSCatalog(autocompleteDoSCatalogSize)
	opts := AutocompleteOptions{Limit: 1}

	baseline := rankAutocomplete(algo, context.Background(), autocompleteDoSQuery(autocompleteDoSBaselineWords), candidates, opts)
	attack := rankAutocomplete(algo, context.Background(), autocompleteDoSQuery(autocompleteDoSAttackWords), candidates, opts)

	if len(baseline.suggestions) != 0 || len(attack.suggestions) != 0 {
		t.Fatalf("probe matched a candidate (baseline %d, attack %d); the query no longer misses the prefilter", len(baseline.suggestions), len(attack.suggestions))
	}
	assertAutocompleteBounded(t, baseline.elapsed, attack.elapsed)
}

func TestRank_CancelledContext_DoesNotScanFuzzyFallback(t *testing.T) {
	algo := NewDefaultAutocompleteAlgorithm()
	candidates := autocompleteDoSCatalog(autocompleteDoSCatalogSize)
	opts := AutocompleteOptions{Limit: 1}

	baseline := rankAutocomplete(algo, context.Background(), autocompleteDoSQuery(autocompleteDoSBaselineWords), candidates, opts)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	attack := rankAutocomplete(algo, ctx, autocompleteDoSQuery(autocompleteDoSAttackWords), candidates, opts)

	if len(attack.suggestions) != 0 {
		t.Fatalf("cancelled Rank returned %d suggestions", len(attack.suggestions))
	}
	assertAutocompleteBounded(t, baseline.elapsed, attack.elapsed)
}

func TestRank_DeadlineDuringScan_StopsFuzzyFallback(t *testing.T) {
	algo := NewDefaultAutocompleteAlgorithm()
	candidates := autocompleteDoSCatalog(autocompleteDoSCatalogSize)
	opts := AutocompleteOptions{Limit: 1}

	ctx, cancel := context.WithTimeout(context.Background(), autocompleteDoSCancelAfter)
	defer cancel()
	started := time.Now()
	suggestions := algo.Rank(ctx, autocompleteDoSQuery(autocompleteDoSAttackWords), candidates, opts)
	elapsed := time.Since(started)

	if len(suggestions) != 0 {
		t.Fatalf("deadline Rank returned %d suggestions", len(suggestions))
	}
	if elapsed > autocompleteDoSCancelCeiling {
		t.Fatalf("Rank ignored a %s deadline and ran for %s", autocompleteDoSCancelAfter, elapsed)
	}
}

func TestRank_AlphabeticalSort_LongUnmatchedQuery_StaysWithinBaseline(t *testing.T) {
	algo := NewDefaultAutocompleteAlgorithm()
	candidates := autocompleteDoSCatalog(autocompleteDoSCatalogSize)
	opts := AutocompleteOptions{Limit: 1, Sort: SortAlphabetical}

	baseline := rankAutocomplete(algo, context.Background(), autocompleteDoSQuery(autocompleteDoSBaselineWords), candidates, opts)
	attack := rankAutocomplete(algo, context.Background(), autocompleteDoSQuery(autocompleteDoSAttackWords), candidates, opts)
	assertAutocompleteBounded(t, baseline.elapsed, attack.elapsed)
}

type autocompleteTiming struct {
	suggestions []Suggestion
	elapsed     time.Duration
}

func rankAutocomplete(algo *DefaultAutocompleteAlgorithm, ctx context.Context, query string, candidates []CandidateConcept, opts AutocompleteOptions) autocompleteTiming {
	started := time.Now()
	suggestions := algo.Rank(ctx, query, candidates, opts)
	return autocompleteTiming{suggestions: suggestions, elapsed: time.Since(started)}
}

func assertAutocompleteBounded(t *testing.T, baseline, observed time.Duration) {
	t.Helper()
	limit := baseline * autocompleteDoSScale
	if limit < autocompleteDoSFloor {
		limit = autocompleteDoSFloor
	}
	if observed > limit {
		t.Fatalf("autocomplete rank took %s; limit %s (baseline %s, scale %d)", observed, limit, baseline, autocompleteDoSScale)
	}
}

func autocompleteDoSCatalog(n int) []CandidateConcept {
	out := make([]CandidateConcept, n)
	for i := range out {
		out[i] = CandidateConcept{
			ID:   fmt.Sprintf("C%04d", i),
			Name: fmt.Sprintf("Condition Alpha %d", i),
			Kind: KindCondition,
		}
	}
	return out
}

func autocompleteDoSQuery(words int) string {
	parts := make([]string, words)
	for i := range parts {
		parts[i] = "qx"
	}
	return strings.Join(parts, " ")
}
