"""Generated catalog smoke tests.

The generator is data-driven; these tests pin the API shape (not the
specific catalog contents) so adding a product / scope / error code in
the upstream source does not break the suite.
"""

from __future__ import annotations

from sah_sdk import (
    ErrorAdviceCodes,
    ErrorCode,
    ErrorDocUrls,
    MedicationUses,
    Product,
    ProductCarriers,
    Products,
    Scope,
    SignEvent,
    State,
    States,
)


def test_products_values_is_non_empty_and_sorted() -> None:
    values = Products.values()
    assert len(values) > 0
    slugs = [p.value for p in values]
    assert slugs == sorted(slugs)


def test_products_by_carrier_filters_case_insensitively() -> None:
    aetna_lower = Products.by_carrier("aetna")
    aetna_mixed = Products.by_carrier("Aetna")
    assert tuple(p.value for p in aetna_lower) == tuple(p.value for p in aetna_mixed)
    assert all(Products.metadata(p).carrier == "aetna" for p in aetna_lower)


def test_products_metadata_returns_shape() -> None:
    for product in Products.values()[:5]:
        meta = Products.metadata(product)
        assert meta.slug == product.value
        assert isinstance(meta.display_name, str)
        assert isinstance(meta.carrier, str)
        assert isinstance(meta.product_class, str)


def test_products_search_prefers_prefix_matches() -> None:
    results = Products.search("fex")
    assert len(results) > 0
    assert all("fex" in p.value.lower() for p in results)


def test_states_by_abbreviation_works_two_ways() -> None:
    nc = States.by_abbreviation("NC")
    assert nc is State.NorthCarolina
    assert States.by_abbreviation("nc") is State.NorthCarolina
    assert States.by_abbreviation("North Carolina") is State.NorthCarolina
    assert States.by_abbreviation("not a state") is None


def test_states_includes_territories() -> None:
    pr = States.metadata(State.PuertoRico)
    assert pr.is_territory is True
    nc = States.metadata(State.NorthCarolina)
    assert nc.is_territory is False


def test_product_carriers_metadata_indexes_back_into_products() -> None:
    aetna_meta = ProductCarriers.metadata("aetna")
    assert aetna_meta.display_name == "Aetna"
    assert all(isinstance(p, Product) for p in aetna_meta.products)


def test_medication_uses_values_sorted() -> None:
    values = MedicationUses.values()
    assert len(values) > 0
    assert list(values) == sorted(values)
    # Metadata lookup returns the same display name.
    first = values[0]
    meta = MedicationUses.metadata(first)
    assert meta.display_name == first
    assert all(isinstance(m, str) for m in meta.medications)


def test_scope_and_sign_event_are_str_enums() -> None:
    for s in Scope:
        assert isinstance(s.value, str)
    for e in SignEvent:
        assert isinstance(e.value, str)


def test_error_codes_have_advice_and_doc_urls() -> None:
    for code in ErrorCode:
        assert code.value in ErrorAdviceCodes
        assert ErrorDocUrls[code.value].startswith("https://docs.isaapi.com/errors/")
