"""Sub-clients for the four zyins-data namespaces added in task #145.

The actual model definitions live in :mod:`.branding`, :mod:`.preferences`,
and :mod:`.cases` — this module hosts only the thin sub-client wrappers
the unified :class:`ZyInsClient` exposes as ``client.branding`` /
``client.preferences`` / ``client.cases`` / ``client.email``.

Separated from :mod:`.client` to keep that module's already-large surface
from growing further; the unified client imports these classes at the
bottom of its constructor.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .branding import BrandingDetail
from .branding import parse_lookup_response as _parse_branding
from .cases import (
    CaseCreateInput,
    CaseCreateResult,
    EmailEnqueueInput,
    EmailEnqueueResult,
)
from .cases import (
    parse_create_response as _parse_cases_create,
)
from .cases import (
    parse_email_response as _parse_email_enqueue,
)
from .preferences import (
    PreferencesResult,
    PreferencesSetInput,
    parse_preferences_response,
)

if TYPE_CHECKING:
    from .client import ZyInsClient


class BrandingSubClient:
    """``client.branding`` namespace — GET ``/v1/branding``."""

    _PATH = "/v1/branding"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def lookup(self) -> BrandingDetail:
        """Fetch the whitelabel branding for the caller's license."""
        raw = self._client._request("GET", self._PATH)
        return _parse_branding(raw)


class PreferencesSubClient:
    """``client.preferences`` namespace — ``/v1/preferences``."""

    _PATH = "/v1/preferences"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def lookup(self) -> PreferencesResult:
        """Fetch the caller's preferences document."""
        raw = self._client._request("GET", self._PATH)
        return parse_preferences_response(raw)

    def set(
        self,
        input: PreferencesSetInput,
        *,
        idempotency_key: str | None = None,
    ) -> PreferencesResult:
        """Upsert the caller's preferences document."""
        raw = self._client._request(
            "POST",
            self._PATH,
            body=input.to_wire_body(),
            idempotency_key=idempotency_key,
        )
        return parse_preferences_response(raw, fallback=input.prefs)


class CasesSubClient:
    """``client.cases`` namespace — create + share cases."""

    _CREATE_PATH = "/v1/case"
    _EMAIL_PATH = "/v1/email/enqueue"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def create(
        self,
        input: CaseCreateInput,
        *,
        idempotency_key: str | None = None,
    ) -> CaseCreateResult:
        """Create a shareable case from quote input + results + products.

        .. deprecated::
            Use :meth:`share` instead. ``create`` is retained as an alias
            for one minor; it will be removed in v0.7.0.
        """
        raw = self._client._request(
            "POST",
            self._CREATE_PATH,
            body=input.to_wire_body(),
            idempotency_key=idempotency_key,
        )
        return _parse_cases_create(raw)

    def share(
        self,
        input: CaseCreateInput,
        *,
        idempotency_key: str | None = None,
    ) -> CaseCreateResult:
        """Create (share) a case. Canonical verb per the locked SDK syntax
        (TS canon: ``isa.zyins.cases.share``); equivalent to :meth:`create`,
        which is retained as a deprecated alias.
        """
        return self.create(input, idempotency_key=idempotency_key)

    def email(
        self,
        input: EmailEnqueueInput,
        *,
        idempotency_key: str | None = None,
    ) -> EmailEnqueueResult:
        """Email a case-share payload — delegates to ``/v1/email/enqueue``."""
        raw = self._client._request(
            "POST",
            self._EMAIL_PATH,
            body=input.to_wire_body(),
            idempotency_key=idempotency_key,
        )
        return _parse_email_enqueue(raw)


class EmailSubClient:
    """``client.email`` namespace — transactional email enqueue."""

    _PATH = "/v1/email/enqueue"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def enqueue(
        self,
        input: EmailEnqueueInput,
        *,
        idempotency_key: str | None = None,
    ) -> EmailEnqueueResult:
        """Enqueue a transactional email for delivery."""
        raw = self._client._request(
            "POST",
            self._PATH,
            body=input.to_wire_body(),
            idempotency_key=idempotency_key,
        )
        return _parse_email_enqueue(raw)
