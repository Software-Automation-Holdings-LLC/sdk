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

from .catalog import (
    ErrorAdviceCodes,
    ErrorCode,
    ErrorDocUrls,
    MedicationUses,
    Product,
    ProductCarriers,
    Products,
    Scope,
    SignEvent,
    State,
    States,
)
from .core.auth import BearerAuth, LicenseAuth, SessionAuth

# NOTE: The catalog ``ErrorCode`` (proto-backed wire codes) is the
# canonical top-level export; the legacy ``core.constants.ErrorCode``
# remains available via the ``sah_sdk.core`` import path for any caller
# already pinned to it.
from .core.constants import ProductLabels, UsState
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
from .zyins.credential_state import LicenseRefreshedEvent
from .zyins.product import Product as ZyinsProduct  # zyins regex helper (legacy)

__version__ = "0.4.0rc1"

# IsaTransportError is the documented error class for network/transport
# failures. Until the runtime maps such failures to it, the alias keeps
# the surface name resolvable.
__all__ = [
    "AuthError",
    "BearerAuth",
    "Email",
    "Envelope",
    "ErrorAdviceCodes",
    "ErrorCode",
    "ErrorDocUrls",
    "ISAError",
    "Isa",
    "IsaApiError",
    "IsaConfigError",
    "IsaIdempotencyConflictError",
    "IsaPermissionError",
    "IsaTransportError",
    "LicenseAuth",
    "LicenseError",
    "LicenseRefreshedEvent",
    "MedicationUses",
    "Money",
    "PrequalifyError",
    "Product",
    "ProductCarriers",
    "ProductLabels",
    "Products",
    "RateLimitError",
    "RawResponse",
    "Scope",
    "SessionAuth",
    "SignEvent",
    "State",
    "States",
    "Url",
    "UsState",
    "ValidationError",
    "ZyinsProduct",
    "__version__",
]
