"""Error-funnel tests."""

from __future__ import annotations

import json

from sah_sdk.core.errors import (
    AuthError,
    ISAError,
    LicenseError,
    PrequalifyError,
    RateLimitError,
    ValidationError,
    from_http_response,
    from_problem_details,
)


def test_429_maps_to_rate_limit_error() -> None:
    err = from_http_response(429, "rate limited", retry_after_seconds=12.0)
    assert isinstance(err, RateLimitError)
    assert err.retry_after_seconds == 12.0
    assert err.code == "rate_limited"


def test_401_maps_to_auth_error() -> None:
    err = from_http_response(401, "bad token")
    assert isinstance(err, AuthError)
    assert err.http_status == 401


def test_403_maps_to_auth_error() -> None:
    err = from_http_response(403, "forbidden")
    assert isinstance(err, AuthError)


def test_problem_details_validation_error() -> None:
    body = json.dumps(
        {
            "code": "validation_error",
            "title": "Bad input",
            "detail": "dob must be ISO 8601",
            "status": 400,
            "param": "applicant.dob",
        }
    )
    err = from_http_response(400, body)
    assert isinstance(err, ValidationError)
    assert err.param == "applicant.dob"
    assert err.code == "validation_error"


def test_problem_details_license_locked() -> None:
    body = json.dumps({"code": "license_locked", "title": "Locked", "status": 423})
    err = from_problem_details(json.loads(body), http_status=423)
    assert isinstance(err, LicenseError)
    assert err.code == "locked"


def test_legacy_err_string_maps_to_license_error() -> None:
    err = from_http_response(401, "ERR_MAX_ACTIVATIONS")
    # 401 takes precedence — AuthError wins over legacy parser by design.
    assert isinstance(err, AuthError)


def test_legacy_err_string_on_400_maps_to_license_error() -> None:
    err = from_http_response(400, "ERR_MAX_ACTIVATIONS")
    assert isinstance(err, LicenseError)
    assert err.code == "max_activations"


def test_unknown_error_collapses_to_generic_isa_error() -> None:
    err = from_http_response(500, "boom")
    assert isinstance(err, ISAError)
    assert err.code == "unknown"
    assert err.http_status == 500


def test_garbage_json_falls_through_to_unknown() -> None:
    err = from_http_response(500, "{not json")
    assert err.code == "unknown"


def test_problem_details_engine_error_maps_to_prequalify_error() -> None:
    body = json.dumps(
        {
            "code": "engine_error",
            "title": "Engine failed",
            "detail": "plan evaluation failed",
            "status": 500,
        }
    )
    err = from_problem_details(json.loads(body), http_status=500)
    assert isinstance(err, PrequalifyError)
    assert err.code == "engine_error"


def test_problem_details_non_numeric_status_does_not_raise() -> None:
    body = json.dumps({"code": "unknown", "title": "Oops", "status": "five"})
    err = from_problem_details(json.loads(body), http_status=502)
    assert isinstance(err, ISAError)
    assert err.http_status == 502


def test_problem_details_unknown_code_does_not_misclassify() -> None:
    # Regression: with ``"unknown"`` previously in PREQUALIFY_ERROR_CODES,
    # any datasets/usage/license error with ``code: "unknown"`` (or a
    # missing ``code`` field that defaulted to ``"unknown"``) was routed
    # into ``PrequalifyError``. The funnel must produce a generic
    # ``ISAError`` so callers can match on subclass for routing.
    body = json.dumps({"code": "unknown", "title": "Oops"})
    err = from_problem_details(json.loads(body), http_status=500)
    assert type(err) is ISAError
    assert not isinstance(err, PrequalifyError)
    assert not isinstance(err, LicenseError)
    assert err.code == "unknown"


def test_problem_details_missing_code_falls_through_to_isa_error() -> None:
    body = json.dumps({"title": "Server fault", "detail": "no code field"})
    err = from_problem_details(json.loads(body), http_status=500)
    assert type(err) is ISAError
    assert err.code == "unknown"


def test_problem_details_license_code_routes_to_license_error() -> None:
    body = json.dumps({"code": "max_activations", "title": "Too many"})
    err = from_problem_details(json.loads(body), http_status=409)
    assert isinstance(err, LicenseError)
    assert err.code == "max_activations"
