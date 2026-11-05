package zyins

import (
	"encoding/json"
	"testing"
)

func TestLegacyPrequalifyBody_MatchesReferenceKeyOrder(t *testing.T) {
	height, err := NewHeightInches(68)
	if err != nil {
		t.Fatal(err)
	}
	weight, err := NewWeight(230)
	if err != nil {
		t.Fatal(err)
	}
	applicant := Applicant{
		DOB:    "1948-08-14",
		Sex:    SexMale,
		Height: height,
		Weight: weight,
		State:  "TX",
		NicotineUse: NicotineUsageInput{
			LastUsed: NicotineWithin12Months,
		},
		Conditions: []Condition{
			{Name: "COPD", WasDiagnosed: "3 YEARS AGO", LastTreatment: "1 MONTH AGO"},
			{Name: "DIABETES", WasDiagnosed: "10 YEARS AGO", LastTreatment: "1 WEEK AGO"},
		},
		Medications: []Medication{
			{Name: "METFORMIN", Use: "DIABETES", FirstFill: "10 YEARS AGO", LastFill: "1 WEEK AGO"},
		},
	}
	raw, err := json.Marshal(legacyPrequalifyBodyFromApplicant(applicant, 25000))
	if err != nil {
		t.Fatal(err)
	}
	const want = `{"date_of_birth":"1948-08-14","gender":"male","state":"TX","height":68,"weight":230,"nicotine_usage":{"is_nicotine_user":true},"conditions":[{"name":"COPD","was_diagnosed":"3 YEARS AGO","last_treatment":"1 MONTH AGO"},{"name":"DIABETES","was_diagnosed":"10 YEARS AGO","last_treatment":"1 WEEK AGO"}],"medications":[{"name":"METFORMIN","use":"DIABETES","first_fill":"10 YEARS AGO","last_fill":"1 WEEK AGO"}],"quote_options":{"quote_type":"face_amounts","amounts":["25000"]}}`
	if string(raw) != want {
		t.Fatalf("legacy prequalify body\n got %s\nwant %s", raw, want)
	}
}

func TestLegacyQuoteBody_OmitsEmptyHistoryAndKeepsReferenceKeyOrder(t *testing.T) {
	height, err := NewHeightInches(64)
	if err != nil {
		t.Fatal(err)
	}
	weight, err := NewWeight(140)
	if err != nil {
		t.Fatal(err)
	}
	applicant := Applicant{
		DOB:    "1962-04-18",
		Sex:    SexFemale,
		Height: height,
		Weight: weight,
		State:  "NC",
		NicotineUse: NicotineUsageInput{
			LastUsed: NicotineNever,
		},
	}
	raw, err := json.Marshal(legacyQuoteBodyFromApplicant(applicant, 25000))
	if err != nil {
		t.Fatal(err)
	}
	const want = `{"date_of_birth":"1962-04-18","gender":"female","state":"NC","height":64,"weight":140,"nicotine_usage":{"is_nicotine_user":false},"quote_options":{"face_amounts":[25000],"pricing_modes":["MONTHLY-EFT"]}}`
	if string(raw) != want {
		t.Fatalf("legacy quote body\n got %s\nwant %s", raw, want)
	}
}
