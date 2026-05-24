"""``sah_sdk.zyins`` — ZyINS underwriting product namespace.

Domain types (Applicant, Medication, …), operation inputs/outputs
(PrequalifyInput, QuoteResult, …), and the product-specific client
(:class:`ZyInsClient`) live here. Cross-cutting concerns (auth, errors,
envelope, transport) live in :mod:`sah_sdk.core` and are re-exported
from the package root as part of the public surface.

The public surface mirrors the canonical TypeScript SDK at
``packages/ts/src/zyins/`` with Python-idiomatic naming (snake_case),
pydantic v2 models for runtime validation, and httpx for transport.
"""

from __future__ import annotations

from ..core.env import IsaConfigError
from ..core.envelope import Envelope, RawResponse
from ..core.errors import (
    AuthError,
    IsaApiError,
    ISAError,
    IsaIdempotencyConflictError,
    LicenseError,
    PrequalifyError,
    RateLimitError,
    ValidationError,
)
from .applicant import (
    Applicant,
    Condition,
    Medication,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsage,
    NicotineUsageInput,
    Sex,
)
from .branding import BrandingDetail
from .cases import (
    CaseCreateInput,
    CaseCreateResult,
    EmailEnqueueInput,
    EmailEnqueueResult,
)
from .client import DEFAULT_BASE_URL, ZyInsClient
from .coverage import Coverage, CoverageType, QuoteType
from .datasets import Dataset
from .health import ProbeResult, ReadinessResult
from .licenses import (
    LicenseCheckInput,
    LicenseCheckResult,
    LicenseDeactivateInput,
    LicenseDeactivateResult,
)
from .licenses_facade import LicenseActivateResult
from .preferences import PreferencesResult, PreferencesSetInput
from .prequalify import PrequalifyInput, PrequalifyPlan, PrequalifyResult
from .product import Product, ProductCatalog, ProductSelection, ProductType
from .products import ProductsFacade
from .quote import QuotedPlan, QuoteInput, QuoteResult
from .reference_data import ReferenceDataResponse
from .usage import UsageSummary

ZyInsError = ISAError


def __getattr__(name: str) -> object:
    """Lazy re-export of ``Isa`` to avoid a top-level circular import.

    ``sah_sdk.__init__`` imports :class:`Isa`, which in turn imports
    domain types from ``sah_sdk.zyins``. Eagerly re-exporting ``Isa`` from
    this module's body would create a cycle (zyins → isa → zyins). A
    module-level :pep:`562` ``__getattr__`` keeps the public surface
    (``from sah_sdk.zyins import Isa``) without the cycle.
    """
    if name == "Isa":
        from ..isa import Isa as _Isa

        return _Isa
    raise AttributeError(f"module 'sah_sdk.zyins' has no attribute {name!r}")


__all__ = [
    "DEFAULT_BASE_URL",
    "Applicant",
    "AuthError",
    "BrandingDetail",
    "CaseCreateInput",
    "CaseCreateResult",
    "Condition",
    "Coverage",
    "CoverageType",
    "Dataset",
    "EmailEnqueueInput",
    "EmailEnqueueResult",
    "Envelope",
    "ISAError",
    "Isa",
    "IsaApiError",
    "IsaConfigError",
    "IsaIdempotencyConflictError",
    "LicenseActivateResult",
    "LicenseCheckInput",
    "LicenseCheckResult",
    "LicenseDeactivateInput",
    "LicenseDeactivateResult",
    "LicenseError",
    "Medication",
    "NicotineDuration",
    "NicotineProductUsage",
    "NicotineUsage",
    "NicotineUsageInput",
    "PreferencesResult",
    "PreferencesSetInput",
    "PrequalifyError",
    "PrequalifyInput",
    "PrequalifyPlan",
    "PrequalifyResult",
    "ProbeResult",
    "Product",
    "ProductCatalog",
    "ProductSelection",
    "ProductType",
    "ProductsFacade",
    "QuoteInput",
    "QuoteResult",
    "QuoteType",
    "QuotedPlan",
    "RateLimitError",
    "RawResponse",
    "ReadinessResult",
    "ReferenceDataResponse",
    "Sex",
    "UsageSummary",
    "ValidationError",
    "ZyInsClient",
    "ZyInsError",
]
