"""``sah_sdk.webhooks`` — webhook signature verification namespace.

Scaffolded stub. The full ``isa.webhooks.verify`` surface lands when the
shared HMAC verifier is published; today the namespace is present so
consumer code resolves against the unified ``Isa`` surface.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .isa import Isa


class WebhooksNamespace:
    """``isa.webhooks`` — placeholder for webhook verification."""

    def __init__(self, isa: Isa) -> None:
        self._isa = isa

    def verify(self, *args: object, **kwargs: object) -> None:
        raise NotImplementedError(
            "isa.webhooks.verify is not yet implemented in the consolidated SDK; "
            "see SDK_DESIGN.md §11 for the planned signature."
        )


__all__ = ["WebhooksNamespace"]
