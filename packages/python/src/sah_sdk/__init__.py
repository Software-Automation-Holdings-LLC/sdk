"""``sah-sdk`` — unified Python SDK for the ISA platform.

One package, three product namespaces:

* ``isa.zyins`` — underwriting (prequalify, quote, datasets).
* ``isa.rapidsign`` — signature workflow (scaffolded; lands in a follow-up phase).
* ``isa.proxy`` — proxy passthrough (scaffolded; lands in a follow-up phase).
* ``isa.webhooks`` — signature verification helpers.

Public surface (see SDK_DESIGN.md §0 + §3):

    >>> from sah_sdk import Isa, Money, Product, ErrorCode
    >>> isa = Isa.with_bearer()              # reads ISA_TOKEN from env
    >>> envelope = isa.zyins.prequalify(req) # returns Envelope[PrequalifyResult]
    >>> envelope.request_id, envelope.data
"""

from __future__ import annotations

from .core.auth import BearerAuth, LicenseAuth, SessionAuth
from .core.constants import ErrorCode, ProductLabels, UsState
from .core.env import IsaConfigError
from .core.envelope import Envelope, RawResponse
from .core.errors import (
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
from .core.value_types import Email, Money, Url
from .isa import Isa
from .zyins.product import Product

__version__ = "0.3.0"

# IsaTransportError is the documented error class for network/transport
# failures. Until the runtime maps such failures to it, the alias keeps
# the surface name resolvable.
__all__ = [
    "AuthError",
    "BearerAuth",
    "Email",
    "Envelope",
    "ErrorCode",
    "ISAError",
    "Isa",
    "IsaApiError",
    "IsaConfigError",
    "IsaIdempotencyConflictError",
    "IsaPermissionError",
    "IsaTransportError",
    "LicenseAuth",
    "LicenseError",
    "Money",
    "PrequalifyError",
    "Product",
    "ProductLabels",
    "RateLimitError",
    "RawResponse",
    "SessionAuth",
    "Url",
    "UsState",
    "ValidationError",
    "__version__",
]
