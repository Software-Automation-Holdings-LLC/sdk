package zyins

import "errors"

// CoverageType is the discriminator for the Coverage union.
type CoverageType string

const (
	// CoverageFaceValue requests coverage by death benefit (USD).
	CoverageFaceValue CoverageType = "face_value"
	// CoverageMonthlyBudget requests coverage by monthly premium (USD).
	CoverageMonthlyBudget CoverageType = "monthly_budget"
)

// Coverage represents the desired coverage in either face-value or
// monthly-budget form. Construct via NewFaceValueCoverage or
// NewMonthlyBudgetCoverage so the type and amount are paired correctly.
type Coverage struct {
	// Type is the discriminator. Set by the constructors.
	Type CoverageType `json:"type"`
	// Amount is the whole-dollar amount. Face value (death benefit) for
	// type=face_value; monthly premium ceiling for type=monthly_budget.
	Amount int `json:"amount"`
}

// NewFaceValueCoverage requests coverage by the dollar amount of death
// benefit. The amount must be a positive integer.
func NewFaceValueCoverage(amount int) (Coverage, error) {
	if amount <= 0 {
		return Coverage{}, errors.New("zyins: NewFaceValueCoverage requires a positive amount")
	}
	return Coverage{Type: CoverageFaceValue, Amount: amount}, nil
}

// NewMonthlyBudgetCoverage requests coverage by the monthly premium the
// applicant can afford. The amount must be a positive integer.
func NewMonthlyBudgetCoverage(amount int) (Coverage, error) {
	if amount <= 0 {
		return Coverage{}, errors.New("zyins: NewMonthlyBudgetCoverage requires a positive amount")
	}
	return Coverage{Type: CoverageMonthlyBudget, Amount: amount}, nil
}

// IsFaceValue reports whether the coverage requests a death-benefit
// amount.
func (c Coverage) IsFaceValue() bool { return c.Type == CoverageFaceValue }

// IsMonthlyBudget reports whether the coverage requests a premium
// ceiling.
func (c Coverage) IsMonthlyBudget() bool { return c.Type == CoverageMonthlyBudget }

// validate returns nil when the coverage is well-formed.
func (c Coverage) validate() error {
	switch c.Type {
	case CoverageFaceValue, CoverageMonthlyBudget:
	default:
		return errors.New("zyins: coverage type must be face_value or monthly_budget")
	}
	if c.Amount <= 0 {
		return errors.New("zyins: coverage amount must be positive")
	}
	return nil
}
