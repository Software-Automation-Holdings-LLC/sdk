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


def test_products_all_is_non_empty() -> None:
    all_products = Products.all()
    assert len(all_products) > 0
    assert all(isinstance(p, Product) for p in all_products)


def test_products_fex_namespace_has_aetna_accendo() -> None:
    p = Products.Fex.AetnaAccendo
    assert p.id == "prod_d7b57156-3e83-506b-8936-0692c1193dc7"
    assert p.name == "Aetna Accendo"
    assert p.product_class == "fex"
    assert isinstance(p.carrier, str)


def test_products_by_id_roundtrip() -> None:
    """by_id(p.id) must return the identical object — the conformance invariant."""
    p = Products.Fex.AetnaAccendo
    assert Products.by_id(p.id) is p


def test_products_by_id_stale_name_returns_none() -> None:
    """Resolving by a slug or stale name string must return None (not an id)."""
    assert Products.by_id("fex-aetna-accendo") is None
    assert Products.by_id("prod_stale-name-does-not-exist") is None


def test_products_medsup_namespace_non_empty() -> None:
    medsup = Products.Medsup.AetnaAccendoMedsup
    assert medsup.product_class == "medsup"


def test_products_term_namespace_non_empty() -> None:
    term = Products.Term.BannerOpterm
    assert term.product_class == "term"


def test_products_preneed_namespace_non_empty() -> None:
    preneed = Products.Preneed.BetterlifeSinglePremium
    assert preneed.product_class == "preneed"


def test_product_carriers_metadata_indexes_into_products() -> None:
    aetna_meta = ProductCarriers.metadata("aetna")
    assert aetna_meta.display_name == "Aetna"
    assert all(isinstance(p, Product) for p in aetna_meta.products)


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


def test_medication_uses_values_sorted() -> None:
    values = MedicationUses.values()
    assert len(values) > 0
    assert list(values) == sorted(values)
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
