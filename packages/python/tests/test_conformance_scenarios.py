"""Cross-language SDK parity test.

Loads ``tests/conformance/scenarios.json`` and verifies that for each scenario
the SDK (or raw HTTP, as a fallback) produces a response matching the
declared assertion vector. The same JSON drives parametrized tests in every
language SDK; drift between SDKs surfaces here.

Requires an isa-mock server reachable at ``ISA_MOCK_URL`` (defaults to
``http://127.0.0.1:4010``). When the mock is unreachable, every scenario is
skipped — so local ``pytest`` doesn't fail on a developer machine without
the mock running.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCENARIOS_PATH = REPO_ROOT / "tests" / "conformance" / "scenarios.json"
MOCK_URL = os.environ.get("ISA_MOCK_URL", "http://127.0.0.1:4010")
HAS_MOCK_URL = "ISA_MOCK_URL" in os.environ
MIN_SCENARIOS = 10
HEALTH_STATUS_NO_CONTENT = 204


def _load_scenarios() -> list[dict[str, Any]]:
    with SCENARIOS_PATH.open("r", encoding="utf-8") as fh:
        parsed = json.load(fh)
    return list(parsed["scenarios"])


def _mock_reachable(url: str) -> bool:
    try:
        response = httpx.get(f"{url}/__healthz_probe__", timeout=0.5)
        return response.status_code == HEALTH_STATUS_NO_CONTENT
    except httpx.HTTPError:
        return False


SCENARIOS = _load_scenarios()


def test_scenarios_file_has_at_least_ten_cases() -> None:
    assert len(SCENARIOS) >= MIN_SCENARIOS, f"expected >={MIN_SCENARIOS} scenarios, found {len(SCENARIOS)}"


@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda s: str(s["name"]))
def test_scenario_against_isa_mock(scenario: dict[str, Any]) -> None:
    if not _mock_reachable(MOCK_URL):
        if HAS_MOCK_URL:
            pytest.fail(f"isa-mock unreachable at {MOCK_URL}")
        pytest.skip(f"isa-mock unreachable at {MOCK_URL}")

    request = scenario["request"]
    expected = scenario["expected"]
    headers: dict[str, str] = dict(request.get("headers") or {})

    body_raw = request.get("body_raw")
    if body_raw is not None:
        content: str | bytes | None = body_raw
    elif request.get("body") is not None:
        content = json.dumps(request["body"])
    else:
        content = None

    resp = httpx.request(
        method=request["method"],
        url=f"{MOCK_URL}{request['path']}",
        headers=headers,
        content=content,
        timeout=5.0,
    )

    assert resp.status_code == expected["status"], (
        f"{scenario['name']}: status mismatch — got {resp.status_code}, body={resp.text[:200]!r}"
    )

    expected_ct = expected.get("content_type")
    if expected_ct is not None:
        assert expected_ct in resp.headers.get("content-type", ""), (
            f"{scenario['name']}: content-type missing {expected_ct!r}; got {resp.headers.get('content-type')!r}"
        )

    if "json" not in resp.headers.get("content-type", ""):
        return

    payload = resp.json()
    for field in expected.get("envelope_fields") or []:
        assert field in payload, f"{scenario['name']}: envelope missing {field!r}"
    for field in expected.get("problem_fields") or []:
        assert field in payload, f"{scenario['name']}: ProblemDetails missing {field!r}"

    expected_code = expected.get("code")
    if expected_code is not None:
        assert payload.get("code") == expected_code

    if expected.get("idempotency_key_echoed") is True:
        sent_key = headers.get("X-Isa-Idempotency-Key")
        assert sent_key is not None, f"{scenario['name']}: request missing idempotency key"
        assert payload.get("idempotency_key") == sent_key, (
            f"{scenario['name']}: envelope idempotency_key did not echo request key"
        )
