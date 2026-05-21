"""Health/readiness sub-client.

Targets the shared platform ``/ready`` probe per
``shared/schemas/api/isa/v1/health.proto``. The probe is unauthenticated;
an attached bearer token is harmless and lets one client instance serve
every operation.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProbeResult(BaseModel):
    """Per-dependency probe outcome."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    status: str = ""
    latency_ms: int = 0
    message: str = ""
    checked_at: str = ""


class ReadinessResult(BaseModel):
    """Output of :meth:`HealthSubClient.get_readiness`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    ready: bool = False
    status: str = ""
    db: ProbeResult = Field(default_factory=ProbeResult)
    cache: ProbeResult = Field(default_factory=ProbeResult)
    downstream_services: dict[str, ProbeResult] = Field(default_factory=dict)
    checked_at: str = ""


def parse_readiness(raw: str) -> ReadinessResult:
    if not raw:
        raise ValueError("readiness: response body was empty")
    parsed: Any = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("readiness: response body was not a JSON object")
    return ReadinessResult.model_validate(parsed)
