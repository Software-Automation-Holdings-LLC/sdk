"""Pluggable ``DatasetSource`` — offline reference loads.

The headline guarantee: ``Isa.with_bearer(datasets=<file>)`` resolves
``conditions.match(...)`` from a committed fixture with ZERO network
activity. A transport that raises on any call backstops that claim — if
the SDK touched the wire, the test would fail loudly.
"""

from __future__ import annotations

import re

import pytest

from sah_sdk import Isa
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.dataset_source import (
    ApiDatasetSource,
    DatasetSourceError,
    FileDatasetSource,
    ResolvingDatasetSource,
    StaticDatasetSource,
    to_dataset_source,
)
from sah_sdk.zyins.datasets_v3 import parse_datasets_v3_envelope

FIXTURE_JSON = """{
  "object": "datasets_catalog",
  "data": {
    "catalog_version": "fixture-3.0",
    "datasets": {
      "conditions": {
        "version": "fixture-c1",
        "item_count": 1,
        "items": [
          {
            "id": "HIGHBLOODPRESSURE",
            "name": "High Blood Pressure",
            "treated_with": [
              {"id": "LISINOPRIL", "name": "Lisinopril", "prescription_count": 8200}
            ]
          }
        ]
      },
      "medications": {
        "version": "fixture-m1",
        "item_count": 1,
        "items": [
          {
            "id": "LISINOPRIL",
            "name": "Lisinopril",
            "used_for": [
              {"id": "HIGHBLOODPRESSURE", "name": "High Blood Pressure", "prescription_count": 8200}
            ]
          }
        ]
      },
      "spelling_corrections": {
        "version": "fixture-s1",
        "item_count": 1,
        "items": [
          {"id": "spl_001", "name": "HYPRTENSION", "from": "HYPRTENSION", "to": "HYPERTENSION"}
        ]
      }
    }
  }
}"""


class _ExplodingTransport:
    """Raises on any request — proves the offline path stays off the wire."""

    def request(self, *_args: object, **_kwargs: object) -> TransportResponse:
        raise AssertionError("network was contacted — offline reference load is broken")


def _file_source() -> FileDatasetSource:
    return FileDatasetSource(
        "/virtual/reference-bundle.json", read_file=lambda _p: FIXTURE_JSON
    )


def test_conditions_match_offline_from_file_source_no_network() -> None:
    isa = Isa.with_bearer(datasets=_file_source(), transport=_ExplodingTransport())

    concept = isa.zyins.conditions.match("high blood pressure")

    assert concept.is_known
    assert concept.kind.value == "condition"
    assert concept.id == "HIGHBLOODPRESSURE"


def test_offline_accepts_in_memory_bundle() -> None:
    bundle = parse_datasets_v3_envelope(FIXTURE_JSON, etag=None)
    isa = Isa.with_bearer(datasets=bundle, transport=_ExplodingTransport())

    assert isa.zyins.medications.match("lisinopril").id == "LISINOPRIL"


def test_offline_warms_autocorrect_from_spelling_table() -> None:
    isa = Isa.with_bearer(datasets=_file_source(), transport=_ExplodingTransport())

    autocorrector = isa.zyins.autocorrector
    assert autocorrector.correct("hyprtension", mode="submit") == "HYPERTENSION"


def test_file_source_parses_slim_bundle() -> None:
    bundle = _file_source().load()
    assert bundle.version == "fixture-3.0"
    assert bundle.conditions[0].id == "HIGHBLOODPRESSURE"


def test_file_source_read_error_names_path() -> None:
    def _raise(_path: str) -> str:
        raise OSError("absent")

    source = FileDatasetSource("/virtual/missing.json", read_file=_raise)
    with pytest.raises(DatasetSourceError, match=re.escape("/virtual/missing.json")):
        source.load()


def test_file_source_parse_error_names_path() -> None:
    source = FileDatasetSource("/virtual/broken.json", read_file=lambda _p: "not json")
    with pytest.raises(DatasetSourceError, match=re.escape("/virtual/broken.json")):
        source.load()


def test_resolving_source_first_success_wins() -> None:
    bundle = parse_datasets_v3_envelope(FIXTURE_JSON, etag=None)
    bad = FileDatasetSource("/virtual/missing.json", read_file=_raise_os)
    chain = ResolvingDatasetSource((bad, StaticDatasetSource(bundle)))
    assert chain.load().version == "fixture-3.0"


def test_resolving_source_runs_on_missing_hook() -> None:
    bundle = parse_datasets_v3_envelope(FIXTURE_JSON, etag=None)
    ran: list[bool] = []
    bad = FileDatasetSource("/virtual/missing.json", read_file=_raise_os)
    api = ApiDatasetSource(fetch=lambda: bundle)
    chain = ResolvingDatasetSource((bad, api), on_missing=lambda: ran.append(True))

    chain.load()

    assert ran == [True]


def test_resolving_source_all_fail_names_attempts() -> None:
    bad = FileDatasetSource("/virtual/a.json", read_file=_raise_os)

    def _api_down() -> object:
        raise RuntimeError("api down")

    api = ApiDatasetSource(fetch=_api_down)  # type: ignore[arg-type]
    chain = ResolvingDatasetSource((bad, api))
    with pytest.raises(
        DatasetSourceError, match=r"FileDatasetSource.*ApiDatasetSource"
    ):
        chain.load()


def test_resolving_source_rejects_empty() -> None:
    with pytest.raises(DatasetSourceError):
        ResolvingDatasetSource(())


def test_to_dataset_source_maps_str_to_file_source() -> None:
    assert isinstance(to_dataset_source("./reference-bundle.json"), FileDatasetSource)


def test_to_dataset_source_maps_bundle_to_static_source() -> None:
    bundle = parse_datasets_v3_envelope(FIXTURE_JSON, etag=None)
    assert isinstance(to_dataset_source(bundle), StaticDatasetSource)


def _raise_os(_path: str) -> str:
    raise OSError("absent")
