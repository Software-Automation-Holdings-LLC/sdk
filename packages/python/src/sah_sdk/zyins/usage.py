"""Usage-summary sub-client.

Returns the agent's API consumption for a billing period. ``period``
is an ISO-style string like ``2026-05`` (month) or ``2026-Q2``
(quarter); the server canonicalizes the format.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ..core.json_response import inner_data_with_request_id


class UsageSummary(BaseModel):
    """Aggregated API usage for a period."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    period: str
    prequalify_calls: int = Field(default=0, alias="prequalify_calls")
    quote_calls: int = Field(default=0, alias="quote_calls")
    total_calls: int = Field(default=0, alias="total_calls")
    request_id: str = ""


def parse_usage_summary(body: str, *, period: str) -> UsageSummary:
    inner, request_id = inner_data_with_request_id(body, context="usage.summary")
    inner.setdefault("period", period)
    if request_id:
        inner.setdefault("request_id", request_id)
    return UsageSummary.model_validate(inner)
