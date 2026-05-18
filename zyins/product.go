package zyins

import (
	"errors"
	"strings"
)

// ProductType is the coarse product category. Wire format uses
// underscore-separated lowercase codes; values here map 1:1.
type ProductType string

const (
	ProductFinalExpense       ProductType = "final_expense"
	ProductTerm               ProductType = "term"
	ProductWholeLife          ProductType = "whole_life"
	ProductMedicareSupplement ProductType = "medicare_supplement"
	ProductUniversal          ProductType = "universal"
	ProductIndexed            ProductType = "indexed"
)

// Product is a single carrier/type combination offered through the
// prequalify engine.
type Product struct {
	// Brand is the carrier identifier (e.g., "colonial-penn").
	Brand string `json:"brand"`
	// Type is the product category.
	Type ProductType `json:"type"`
	// WireToken is the engine's canonical brand-and-type string. Stable
	// within a wire major version.
	WireToken string `json:"wire_token"`
	// DisplayName is the human-readable label for UI surfaces.
	DisplayName string `json:"display_name,omitempty"`
}

// ProductSelection groups one or more products for a single prequalify
// call. WireString renders the `|`-joined token expression the engine
// accepts so call sites never assemble it manually.
type ProductSelection struct {
	products []Product
}

// NewProductSelection constructs a selection from one or more wire
// tokens. The tokens are not validated against the catalog; callers
// with a typed Product should use NewProductSelectionFromProducts.
//
// Tokens with surrounding whitespace are rejected (not trimmed): the
// wire contract treats the token as opaque, and silently trimming
// would mean the stored value diverges from what the caller passed
// — a hard-to-diagnose source of "why doesn't this match the catalog"
// reports.
func NewProductSelection(tokens ...string) (ProductSelection, error) {
	if len(tokens) == 0 {
		return ProductSelection{}, errors.New("zyins: NewProductSelection requires at least one token")
	}
	products := make([]Product, 0, len(tokens))
	for _, t := range tokens {
		trimmed := strings.TrimSpace(t)
		if len(trimmed) == 0 {
			return ProductSelection{}, errors.New("zyins: product token cannot be empty")
		}
		if len(trimmed) != len(t) {
			return ProductSelection{}, errors.New("zyins: product token has leading or trailing whitespace; trim before passing to the SDK")
		}
		products = append(products, Product{WireToken: t})
	}
	return ProductSelection{products: products}, nil
}

// NewProductSelectionFromProducts constructs a selection from a list of
// typed Product values.
func NewProductSelectionFromProducts(products ...Product) (ProductSelection, error) {
	if len(products) == 0 {
		return ProductSelection{}, errors.New("zyins: NewProductSelectionFromProducts requires at least one product")
	}
	for _, p := range products {
		trimmed := strings.TrimSpace(p.WireToken)
		if len(trimmed) == 0 {
			return ProductSelection{}, errors.New("zyins: product wire token cannot be empty")
		}
		if len(trimmed) != len(p.WireToken) {
			return ProductSelection{}, errors.New("zyins: product wire token has leading or trailing whitespace; trim before passing to the SDK")
		}
	}
	out := make([]Product, len(products))
	copy(out, products)
	return ProductSelection{products: out}, nil
}

// WireString renders the prequalify wire string: a `|`-joined list of
// product tokens. The shape is the engine's stable contract.
func (p ProductSelection) WireString() string {
	tokens := make([]string, 0, len(p.products))
	for _, prod := range p.products {
		tokens = append(tokens, prod.WireToken)
	}
	return strings.Join(tokens, "|")
}

// Products returns a read-only view of the selection contents.
func (p ProductSelection) Products() []Product {
	out := make([]Product, len(p.products))
	copy(out, p.products)
	return out
}

// Len returns the number of products in the selection.
func (p ProductSelection) Len() int { return len(p.products) }
