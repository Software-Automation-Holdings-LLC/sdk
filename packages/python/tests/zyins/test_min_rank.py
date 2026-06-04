"""Tests for the MinRank value set and its synonym aliasing."""

from __future__ import annotations

import json

import pytest

from sah_sdk.zyins import MinRank
from sah_sdk.zyins.prequalify_v3 import PrequalifyV3Options


class TestMinRank:
    @pytest.mark.parametrize(
        ("member", "wire_token"),
        [
            (MinRank.IMMEDIATE, "immediate"),
            (MinRank.GRADED, "graded"),
            (MinRank.ROP, "rop"),
            (MinRank.GUARANTEED, "guaranteed"),
        ],
    )
    def test_canonical_member_serializes_to_lowercase_wire_token(
        self, member: MinRank, wire_token: str
    ) -> None:
        assert member.value == wire_token
        assert member == wire_token
        assert json.dumps({"min_rank": member}) == f'{{"min_rank": "{wire_token}"}}'

    def test_synonyms_alias_onto_canonical_member(self) -> None:
        assert MinRank.RETURN_OF_PREMIUM is MinRank.ROP
        assert MinRank.GUARANTEED_ISSUE is MinRank.GUARANTEED
        assert MinRank.GI is MinRank.GUARANTEED

    def test_only_four_canonical_members_are_distinct(self) -> None:
        assert {m.value for m in MinRank} == {
            "immediate",
            "graded",
            "rop",
            "guaranteed",
        }

    def test_member_assigns_to_string_option_field(self) -> None:
        # MinRank subclasses str, so a member satisfies the str field directly —
        # the non-breaking escape hatch.
        options = PrequalifyV3Options(min_rank=MinRank.GI)
        assert options.min_rank == "guaranteed"
