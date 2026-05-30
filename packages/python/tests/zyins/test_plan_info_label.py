"""Tests for the typed plan-info surface + Title Case label derivation.

Mirrors ``packages/ts/tests/zyins/`` coverage: special-cased acronyms,
generic snake_case → Title Case, and the legacy-map → typed-array
upconversion path.
"""

from __future__ import annotations

import pytest

from sah_sdk.zyins.plan_info_label import (
    PlanInfoItem,
    coerce_plan_info,
    title_case_label,
)


class TestTitleCaseLabel:
    """The post-zyins#349 wire shape carries server-emitted labels; the
    legacy upconversion path synthesizes labels from snake_case keys via
    this helper. Behavior must match TS ``titleCaseLabel`` exactly so a
    consumer reading both SDKs sees the same display strings.
    """

    @pytest.mark.parametrize(
        "key,expected",
        [
            ("eapp", "eApp"),
            ("EApp", "eApp"),
            ("EAPP", "eApp"),
            ("url", "URL"),
            ("pdf", "PDF"),
            ("api", "API"),
            ("ssn", "SSN"),
            ("ach", "ACH"),
            ("eft", "EFT"),
            ("id", "ID"),
        ],
    )
    def test_special_acronyms_preserve_canonical_capitalization(
        self, key: str, expected: str
    ) -> None:
        assert title_case_label(key) == expected

    @pytest.mark.parametrize(
        "key,expected",
        [
            ("rate_class", "Rate Class"),
            ("rate_class_notes", "Rate Class Notes"),
            ("telesales", "Telesales"),
            ("max-issue-age", "Max Issue Age"),
            ("face_amount_max", "Face Amount Max"),
        ],
    )
    def test_generic_snake_kebab_case_title_cases_each_word(
        self, key: str, expected: str
    ) -> None:
        assert title_case_label(key) == expected

    def test_special_token_inside_a_compound_key(self) -> None:
        """A special acronym mixed with regular tokens preserves the
        canonical capitalization for the matching token only.
        """
        assert title_case_label("api_url") == "API URL"
        assert title_case_label("eapp_telesales") == "eApp Telesales"
        assert title_case_label("submit_pdf") == "Submit PDF"

    def test_empty_string_returns_empty(self) -> None:
        assert title_case_label("") == ""

    def test_consecutive_separators_collapse(self) -> None:
        """``foo__bar`` and ``foo--bar`` produce the same label as
        ``foo_bar``; consecutive separators collapse into one split.
        """
        assert title_case_label("foo__bar") == "Foo Bar"
        assert title_case_label("foo--bar") == "Foo Bar"
        assert title_case_label("foo_-bar") == "Foo Bar"


class TestPlanInfoItem:
    """The dataclass is frozen + slots — values are immutable per-instance
    and the type carries no wasted memory. ``key`` cannot be empty.
    """

    def test_construction_with_valid_args(self) -> None:
        item = PlanInfoItem(key="eapp", label="eApp", values=("yes",))
        assert item.key == "eapp"
        assert item.label == "eApp"
        assert item.values == ("yes",)

    def test_empty_key_raises(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            PlanInfoItem(key="", label="X", values=())

    def test_frozen_instance_is_immutable(self) -> None:
        item = PlanInfoItem(key="eapp", label="eApp", values=())
        with pytest.raises((AttributeError, TypeError)):
            item.key = "other"


class TestCoercePlanInfo:
    """The wire ``plan_info`` field arrives as either a typed array
    (post-#349) or a legacy map (pre-#349). The SDK must produce the
    same typed array surface from either shape.
    """

    def test_typed_array_used_verbatim(self) -> None:
        wire = [
            {"key": "eapp", "label": "eApp", "values": ["yes"]},
            {"key": "telesales", "label": "Telesales", "values": ["no"]},
        ]
        items = coerce_plan_info(wire)
        assert len(items) == 2
        assert items[0] == PlanInfoItem(key="eapp", label="eApp", values=("yes",))
        assert items[1] == PlanInfoItem(key="telesales", label="Telesales", values=("no",))

    def test_typed_array_synthesizes_label_when_missing(self) -> None:
        wire = [{"key": "rate_class_notes", "values": ["A"]}]
        items = coerce_plan_info(wire)
        assert items[0].label == "Rate Class Notes"

    def test_typed_array_skips_entries_without_key(self) -> None:
        wire = [{"label": "Orphan", "values": []}, {"key": "eapp", "values": []}]
        items = coerce_plan_info(wire)
        assert len(items) == 1
        assert items[0].key == "eapp"

    def test_legacy_map_upconverts_to_typed_array(self) -> None:
        """A pre-#349 ``Record<string, string[]>`` body upconverts to
        the typed array; labels are Title-Cased from the keys.
        """
        wire = {"eapp": ["yes"], "rate_class": ["preferred"]}
        items = coerce_plan_info(wire)
        keys = {i.key for i in items}
        assert keys == {"eapp", "rate_class"}
        labels = {i.key: i.label for i in items}
        assert labels == {"eapp": "eApp", "rate_class": "Rate Class"}

    def test_unknown_shape_returns_empty_tuple(self) -> None:
        """Lenient — any shape we don't recognize parses to an empty
        tuple so a forward-compatible field addition can't break parsing.
        """
        assert coerce_plan_info(None) == ()
        assert coerce_plan_info("string") == ()
        assert coerce_plan_info(42) == ()

    def test_non_string_values_are_dropped(self) -> None:
        wire = [{"key": "eapp", "values": ["yes", 42, None, "no"]}]
        items = coerce_plan_info(wire)
        assert items[0].values == ("yes", "no")

    def test_string_values_field_is_ignored(self) -> None:
        wire = [{"key": "eapp", "values": "yes"}]
        items = coerce_plan_info(wire)
        assert items[0].values == ()

    def test_wire_order_preserved(self) -> None:
        wire = [
            {"key": "z", "values": []},
            {"key": "a", "values": []},
            {"key": "m", "values": []},
        ]
        items = coerce_plan_info(wire)
        assert [i.key for i in items] == ["z", "a", "m"]
