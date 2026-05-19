"""``sah_sdk.core`` — cross-product primitives shared by every namespace.

This package holds the pieces that have nothing to do with any one
product (zyins, rapidsign, proxy): authentication strategies, the typed
error hierarchy, the response envelope, the HTTP transport, environment
readers, and the small set of generic value types and constants that
recur across products.

The public surface is re-exported from :mod:`sah_sdk` at the package
root so consumers never have to import directly from ``sah_sdk.core``.
"""

from __future__ import annotations

from .auth import BearerAuth, LicenseAuth, SessionAuth
from .constants import ErrorCode, ProductLabels, UsState
from .env import IsaConfigError
from .envelope import Envelope, RawResponse
from .errors import (
    AuthError,
    IsaApiError,
    ISAError,
    IsaIdempotencyConflictError,
    IsaPermissionError,
    IsaTransportError,
    LicenseError,
    PrequalifyError,
    RateLimitError,
    ValidationError,
)
from .value_types import Email, Money, Url

__all__ = [
    "AuthError",
    "BearerAuth",
    "Email",
    "Envelope",
    "ErrorCode",
    "ISAError",
    "IsaApiError",
    "IsaConfigError",
    "IsaIdempotencyConflictError",
    "IsaPermissionError",
    "IsaTransportError",
    "LicenseAuth",
    "LicenseError",
    "Money",
    "PrequalifyError",
    "ProductLabels",
    "RateLimitError",
    "RawResponse",
    "SessionAuth",
    "Url",
    "UsState",
    "ValidationError",
]
