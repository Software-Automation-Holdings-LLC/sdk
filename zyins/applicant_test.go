package zyins

import "testing"

func TestSexWireCode_MapsMaleAndFemale(t *testing.T) {
	got, err := SexWireCode(SexMale)
	if err != nil || got != "M" {
		t.Errorf("SexWireCode(Male) = (%q, %v), want (M, nil)", got, err)
	}
	got, err = SexWireCode(SexFemale)
	if err != nil || got != "F" {
		t.Errorf("SexWireCode(Female) = (%q, %v), want (F, nil)", got, err)
	}
}

func TestSexWireCode_UnknownValueReturnsError(t *testing.T) {
	cases := []Sex{"", "unknown", "MALE", "f", "x"}
	for _, s := range cases {
		got, err := SexWireCode(s)
		if err == nil {
			t.Errorf("SexWireCode(%q) = (%q, nil); want error", string(s), got)
		}
		if got != "" {
			t.Errorf("SexWireCode(%q) returned non-empty %q on error", string(s), got)
		}
	}
}

func TestApplicant_Validate_RejectsUnknownSex(t *testing.T) {
	h, _ := NewHeight(5, 10)
	w, _ := NewWeight(195)
	a := Applicant{
		DOB:         "1962-04-18",
		Sex:         Sex("MALE"), // wrong casing — not a recognized enum value
		Height:      h,
		Weight:      w,
		State:       "NC",
		NicotineUse: NicotineNone,
	}
	if err := a.validate(); err == nil {
		t.Errorf("validate() accepted unknown Sex value")
	}
}

func TestNewHeight_FeetInches(t *testing.T) {
	h, err := NewHeight(5, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h.TotalInches != 70 {
		t.Errorf("TotalInches = %d, want 70", h.TotalInches)
	}
}

func TestNewHeight_NegativeReturnsError(t *testing.T) {
	if _, err := NewHeight(-1, 0); err == nil {
		t.Errorf("expected error for negative feet")
	}
	if _, err := NewHeight(5, -1); err == nil {
		t.Errorf("expected error for negative inches")
	}
}

func TestNewWeight_PositiveOnly(t *testing.T) {
	w, err := NewWeight(195)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if w.Pounds != 195 {
		t.Errorf("Pounds = %d, want 195", w.Pounds)
	}
	if _, err := NewWeight(0); err == nil {
		t.Errorf("expected error for zero")
	}
	if _, err := NewWeight(-1); err == nil {
		t.Errorf("expected error for negative")
	}
}

func TestApplicant_Validate_RequiresFields(t *testing.T) {
	full := func() Applicant {
		h, _ := NewHeight(5, 10)
		w, _ := NewWeight(195)
		return Applicant{
			DOB:         "1962-04-18",
			Sex:         SexMale,
			Height:      h,
			Weight:      w,
			State:       "NC",
			NicotineUse: NicotineNone,
		}
	}
	a := full()
	if err := a.validate(); err != nil {
		t.Fatalf("complete applicant should validate; got %v", err)
	}

	cases := map[string]func(*Applicant){
		"missing dob":      func(a *Applicant) { a.DOB = "" },
		"missing sex":      func(a *Applicant) { a.Sex = "" },
		"missing height":   func(a *Applicant) { a.Height = Height{} },
		"missing weight":   func(a *Applicant) { a.Weight = Weight{} },
		"missing state":    func(a *Applicant) { a.State = "" },
		"missing nicotine": func(a *Applicant) { a.NicotineUse = "" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			a := full()
			mutate(&a)
			if err := a.validate(); err == nil {
				t.Errorf("expected validation error after %s", name)
			}
		})
	}
}
