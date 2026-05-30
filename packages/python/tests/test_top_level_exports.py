"""Verify the cross-language doc surface resolves at the top level.

The quickstart guides import the typed value set directly from
``sah_sdk`` — this test asserts that surface stays present.
"""

from __future__ import annotations


def test_quickstart_top_level_imports_resolve() -> None:
    # Mirrors `from sah_sdk import …` in api/guides/quickstart.md.
    from sah_sdk import (
        Carrier,
        Coverage,
        Eligibility,
        Height,
        Isa,
        NicotineUsage,
        PlanProduct,
        Premium,
        PrequalifyPlan,
        Product,
        Sex,
        State,
        Weight,
    )

    # Sanity: the symbols are the right types, not stubs.
    assert Sex.MALE.value == "male"
    assert Height.from_feet_inches(5, 10).inches == 70
    assert Weight.from_pounds(195).pounds == 195
    assert callable(Coverage.face_value)
    assert hasattr(State, "NorthCarolina")
    assert hasattr(Product, "FexAetnaAccendo")
    assert NicotineUsage.NONE.value == "none"
    # The v2 typed sub-objects are exported (not just present on the model).
    assert Carrier().name == ""
    assert PlanProduct().wire_token == ""
    assert Eligibility().eligible is False
    assert Premium().cents == 0
    assert PrequalifyPlan().carrier.name == ""
    # Isa carries the named factory the docs use.
    assert hasattr(Isa, "with_bearer")


def test_isa_sdk_alias_resolves_to_same_objects() -> None:
    """``isa_sdk`` is the cross-language canonical name; verify shim."""
    import isa_sdk
    import sah_sdk

    assert isa_sdk.Isa is sah_sdk.Isa
    assert isa_sdk.Height is sah_sdk.Height
    assert isa_sdk.Weight is sah_sdk.Weight
    assert isa_sdk.Sex is sah_sdk.Sex
    assert isa_sdk.Coverage is sah_sdk.Coverage
    assert isa_sdk.Carrier is sah_sdk.Carrier
    assert isa_sdk.Premium is sah_sdk.Premium

    # Submodule access works through either spelling.
    from isa_sdk.zyins import Applicant as IsaApplicant
    from sah_sdk.zyins import Applicant as SahApplicant

    assert IsaApplicant is SahApplicant


def test_isa_sdk_nested_submodules_resolve() -> None:
    """Package aliases preserve deeper ``sah_sdk`` import paths."""
    from isa_sdk.core.env import IsaConfigError as IsaAliasConfigError
    from isa_sdk.zyins.prequalify import PrequalifyInput as IsaAliasPrequalifyInput

    from sah_sdk.core.env import IsaConfigError
    from sah_sdk.zyins.prequalify import PrequalifyInput

    assert IsaAliasConfigError is IsaConfigError
    assert IsaAliasPrequalifyInput is PrequalifyInput


def test_isa_with_bearer_returns_isa_not_object() -> None:
    """Regression: mypy must narrow ``with_bearer`` to ``Isa``.

    A ``-> object`` annotation here would defeat consumer autocompletion.
    """
    import inspect

    from sah_sdk import Isa

    sig = inspect.signature(Isa.with_bearer)
    # Return annotation is a forward reference / class itself.
    assert sig.return_annotation in (Isa, "Isa", Isa.__name__)
