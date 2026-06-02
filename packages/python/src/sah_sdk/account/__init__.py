"""``isa.account.*`` — per-license account operations.

Wraps the five account-service endpoints (branding, preferences, cases,
email, reference-data) into a single typed surface. Construction is lazy:
the namespace stores the auth + transport + clock context once and exposes
one sub-facade per resource.

The namespace targets the License-HMAC auth path. The legacy ``isa.zyins``
branding / preferences / cases / email surface is preserved for back-compat
and shares the same wire endpoints; ``account`` is the forward-looking
ergonomic surface and adds the missing operations (``cases.get``,
``cases.list``, ``reference_data.get``, scope-partitioned preferences).

Mirror of ``packages/ts/src/account/index.ts``.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from ..core.license_hmac import LicenseClock, system_license_clock
from ..core.transport import HttpTransport, Transport
from .branding import AccountBranding, BrandingDetail, BrandingLookupRequest
from .case_crypto import RandomBytes, system_random_bytes
from .case_link import DEFAULT_CASE_VIEWER_BASE_URL
from .cases import (
    AccountCases,
    CaseCreateRequest,
    CaseCreateResult,
    CaseEmailRequest,
    CaseEmailResult,
    CaseOpenResult,
    CaseShareRequest,
    CaseShareResult,
    CaseSummary,
)
from .email import (
    AccountEmail,
    EmailAttachment,
    EmailEnqueueRequest,
    EmailEnqueueResult,
)
from .preferences import (
    AccountPreferences,
    PreferencesDocument,
    PreferencesLookupRequest,
    PreferencesLookupResult,
    PreferencesSetRequest,
    PreferencesSetResult,
)
from .reference_data import (
    AccountReferenceData,
    ReferenceDataRequest,
    ReferenceDataResult,
)


@dataclass(frozen=True, slots=True)
class AuthContext:
    """License-HMAC auth context shared by every account operation.

    A single :class:`AuthContext` is reused across every method on
    :class:`AccountNamespace` so HMAC headers can be regenerated per
    request from one identity blob.
    """

    license_key: str
    order_id: str
    email: str
    device_id: str


@dataclass(frozen=True, slots=True)
class _OperationContext:
    """Internal — assembled once and passed to each operation function."""

    auth: Callable[[], AuthContext]
    base_url: str
    transport: Transport
    clock: LicenseClock
    case_viewer_base_url: str
    random_bytes: RandomBytes


class AccountNamespace:
    """Top-level ``isa.account.*`` namespace."""

    branding: AccountBranding
    preferences: AccountPreferences
    cases: AccountCases
    email: AccountEmail
    reference_data: AccountReferenceData

    def __init__(
        self,
        *,
        auth: AuthContext | Callable[[], AuthContext],
        base_url: str,
        transport: Transport | None = None,
        clock: LicenseClock | None = None,
        case_viewer_base_url: str = DEFAULT_CASE_VIEWER_BASE_URL,
        random_bytes: RandomBytes | None = None,
    ) -> None:
        auth_provider = auth if callable(auth) else lambda: auth
        resolved_transport = transport or HttpTransport()
        ctx = _OperationContext(
            auth=auth_provider,
            base_url=base_url.rstrip("/"),
            transport=resolved_transport,
            clock=clock or system_license_clock,
            case_viewer_base_url=case_viewer_base_url,
            random_bytes=random_bytes or system_random_bytes,
        )
        self._ctx = ctx
        self._owns_transport = transport is None
        self.branding = AccountBranding(ctx)
        self.preferences = AccountPreferences(ctx)
        self.cases = AccountCases(ctx)
        self.email = AccountEmail(ctx)
        self.reference_data = AccountReferenceData(ctx)

    def close(self) -> None:
        if self._owns_transport and isinstance(self._ctx.transport, HttpTransport):
            self._ctx.transport.close()


__all__ = [
    "DEFAULT_CASE_VIEWER_BASE_URL",
    "AccountBranding",
    "AccountCases",
    "AccountEmail",
    "AccountNamespace",
    "AccountPreferences",
    "AccountReferenceData",
    "AuthContext",
    "BrandingDetail",
    "BrandingLookupRequest",
    "CaseCreateRequest",
    "CaseCreateResult",
    "CaseEmailRequest",
    "CaseEmailResult",
    "CaseOpenResult",
    "CaseShareRequest",
    "CaseShareResult",
    "CaseSummary",
    "EmailAttachment",
    "EmailEnqueueRequest",
    "EmailEnqueueResult",
    "PreferencesDocument",
    "PreferencesLookupRequest",
    "PreferencesLookupResult",
    "PreferencesSetRequest",
    "PreferencesSetResult",
    "ReferenceDataRequest",
    "ReferenceDataResult",
]
