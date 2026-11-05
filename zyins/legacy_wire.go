package zyins

import (
	"os"
	"strconv"
	"strings"
)

// legacyWireEnabled reports whether outbound requests should use the
// engine's legacy flat-body shape (date_of_birth, gender, quote_options)
// instead of the typed applicant envelope. Conformance CI sets
// ZYINS_LEGACY_WIRE=1 while the live API and SDK wire formats converge.
func legacyWireEnabled() bool {
	return strings.TrimSpace(os.Getenv("ZYINS_LEGACY_WIRE")) == "1"
}

// legacyNicotine is the flat nicotine object the live engine reads.
type legacyNicotine struct {
	IsNicotineUser bool `json:"is_nicotine_user"`
}

// legacyPrequalifyQuoteOptions is quote_options for /v1/prequalify.
type legacyPrequalifyQuoteOptions struct {
	QuoteType string   `json:"quote_type"`
	Amounts   []string `json:"amounts"`
}

// legacyQuoteQuoteOptions is quote_options for the legacy quote path.
type legacyQuoteQuoteOptions struct {
	FaceAmounts  []int    `json:"face_amounts"`
	PricingModes []string `json:"pricing_modes"`
}

// legacyFlatBody is the flat JSON body the live engine still accepts.
// Fields are struct fields, not a map, so the encoded key order matches
// the HTTP reference and the PHP and C# legacy encoders. A map is sorted
// alphabetically and the live prequalify matrix then diverges on the
// declined-risk persona (one tied plan flips).
type legacyFlatBody struct {
	DateOfBirth   string         `json:"date_of_birth"`
	Gender        string         `json:"gender"`
	State         State          `json:"state"`
	Height        int            `json:"height"`
	Weight        int            `json:"weight"`
	NicotineUsage legacyNicotine `json:"nicotine_usage"`
	Conditions    []Condition    `json:"conditions,omitempty"`
	Medications   []Medication   `json:"medications,omitempty"`
	QuoteOptions  any            `json:"quote_options,omitempty"`
}

// legacyEngineBodyFromApplicant builds the shared applicant block.
func legacyEngineBodyFromApplicant(a Applicant) legacyFlatBody {
	sex := "male"
	if a.Sex == SexFemale {
		sex = "female"
	}
	nicotine := a.resolveNicotineUsageInput().LastUsed == NicotineWithin12Months
	body := legacyFlatBody{
		DateOfBirth: a.DOB,
		Gender:      sex,
		State:       a.State,
		Height:      a.Height.TotalInches,
		Weight:      a.Weight.Pounds,
		NicotineUsage: legacyNicotine{
			IsNicotineUser: nicotine,
		},
		Conditions:  a.Conditions,
		Medications: a.Medications,
	}
	return body
}

func legacyPrequalifyBodyFromApplicant(a Applicant, faceValue int) legacyFlatBody {
	body := legacyEngineBodyFromApplicant(a)
	body.QuoteOptions = legacyPrequalifyQuoteOptions{
		QuoteType: "face_amounts",
		Amounts:   []string{strconv.Itoa(faceValue)},
	}
	return body
}

func legacyQuoteBodyFromApplicant(a Applicant, faceValue int) legacyFlatBody {
	body := legacyEngineBodyFromApplicant(a)
	body.QuoteOptions = legacyQuoteQuoteOptions{
		FaceAmounts:  []int{faceValue},
		PricingModes: []string{"MONTHLY-EFT"},
	}
	return body
}

// defaultLegacyFaceAmount reads the requested face value from coverage.
func defaultLegacyFaceAmount(c Coverage) int {
	if c.Type == CoverageFaceValue && c.Amount > 0 {
		return c.Amount
	}
	return 25_000
}
