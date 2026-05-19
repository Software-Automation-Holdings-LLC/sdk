"""License sub-client.

Mirrors the TS ``license`` sub-client: ``activate``, ``deactivate``,
``check``. Under the post-#286 bearer-token contract, these endpoints
are primarily used by the BPP installer; SDK callers usually skip
them because the bearer token is already long-lived.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from ..core.json_response import inner_data_with_request_id


class LicenseActivateResult(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    license_key: str = ""
    order_id: str = ""
    email: str = ""
    request_id: str = ""


class LicenseCheckResult(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    active: bool = False
    email: str = ""
    request_id: str = ""


def parse_activate(body: str) -> LicenseActivateResult:
    inner, request_id = inner_data_with_request_id(body, context="license.activate")
    result = LicenseActivateResult.model_validate(inner)
    if request_id and not result.request_id:
        return result.model_copy(update={"request_id": request_id})
    return result


def parse_check(body: str) -> LicenseCheckResult:
    inner, request_id = inner_data_with_request_id(body, context="license.check")
    result = LicenseCheckResult.model_validate(inner)
    if request_id and not result.request_id:
        return result.model_copy(update={"request_id": request_id})
    return result
