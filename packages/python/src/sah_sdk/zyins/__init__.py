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

from typing import TYPE_CHECKING, Any

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
from .isa_options import (
    DEFAULT_TIMEOUT_SECONDS,
    BearerAuth,
    FormAuth,
    InMemoryEngine,
    IsaApiVersion,
    IsaAuthSupplier,
    IsaCreateOptions,
    IsaEngine,
    LicenseAuth,
    LocalEngine,
    ProxyEngine,
    RemoteEngine,
    ResolvedIsaOptions,
    SessionAuth,
    resolve_isa_options,
)
from .licenses import (
    LicenseCheckInput,
    LicenseCheckResult,
    LicenseDeactivateInput,
    LicenseDeactivateResult,
)
from .licenses_facade import LicenseActivateResult
from .measurements import Height, HeightParseError, Weight, WeightParseError
from .min_rank import MinRank
from .plan_info_label import PlanInfoItem, coerce_plan_info, title_case_label
from .preferences import PreferencesResult, PreferencesSetInput
from .prequalify import (
    Carrier,
    Eligibility,
    PlanProduct,
    Premium,
    PrequalifyInput,
    PrequalifyPlan,
    PrequalifyResult,
)
from .prequalify_v3 import (
    PrequalifyV3Options,
    PrequalifyV3Request,
    PrequalifyV3Result,
    V3Offer,
    by_amount,
)
from .product import Product, ProductSelection, ProductType
from .quote import QuotedPlan, QuoteInput, QuoteResult
from .quote_v3 import QuoteV3Options, QuoteV3Request
from .reference_data import ReferenceDataResponse
from .usage import UsageSummary

ZyInsError = ISAError

# Cross-language naming alias: TS/PHP/C# use ``IsaRateLimitError``; the
# Python core class historically shipped as ``RateLimitError``. Both
# resolve to the same exception type so docs that import either form
# work uniformly.
IsaRateLimitError = RateLimitError

# De-versioned canonical request types. The public call site is
# unversioned (``isa.zyins.prequalify`` routes to the bundled /vN), so the
# request types it accepts carry no version suffix either. These aliases
# are the v3 request shapes under their canonical names; see
# api/guides/api-version-pinning.md.
PrequalifyRequest = PrequalifyV3Request
PrequalifyOptions = PrequalifyV3Options
QuoteRequest = QuoteV3Request
QuoteOptions = QuoteV3Options


if TYPE_CHECKING:
    # Static-type-checker view: ``Isa`` is a real attribute of this
    # module. The runtime keeps the lazy ``__getattr__`` below to break
    # the circular import; mypy/pyright never execute the runtime branch
    # so they see the eager binding here. This fixes the long-standing
    # "Isa narrowed to object" surface drift caught by Gate 2 of the
    # docs-conformance harness.
    from ..isa import Isa as Isa


def __getattr__(name: str) -> Any:
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
    "DEFAULT_TIMEOUT_SECONDS",
    "Applicant",
    "AuthError",
    "BearerAuth",
    "BrandingDetail",
    "Carrier",
    "CaseCreateInput",
    "CaseCreateResult",
    "Condition",
    "Coverage",
    "CoverageType",
    "Dataset",
    "Eligibility",
    "EmailEnqueueInput",
    "EmailEnqueueResult",
    "Envelope",
    "FormAuth",
    "Height",
    "HeightParseError",
    "ISAError",
    "InMemoryEngine",
    "Isa",
    "IsaApiError",
    "IsaApiVersion",
    "IsaAuthSupplier",
    "IsaConfigError",
    "IsaCreateOptions",
    "IsaEngine",
    "IsaIdempotencyConflictError",
    "IsaRateLimitError",
    "LicenseActivateResult",
    "LicenseAuth",
    "LicenseCheckInput",
    "LicenseCheckResult",
    "LicenseDeactivateInput",
    "LicenseDeactivateResult",
    "LicenseError",
    "LocalEngine",
    "Medication",
    "MinRank",
    "NicotineDuration",
    "NicotineProductUsage",
    "NicotineUsage",
    "NicotineUsageInput",
    "PlanInfoItem",
    "PlanProduct",
    "PreferencesResult",
    "PreferencesSetInput",
    "Premium",
    "PrequalifyError",
    "PrequalifyInput",
    "PrequalifyOptions",
    "PrequalifyPlan",
    "PrequalifyRequest",
    "PrequalifyResult",
    "PrequalifyV3Options",
    "PrequalifyV3Request",
    "PrequalifyV3Result",
    "ProbeResult",
    "Product",
    "ProductSelection",
    "ProductType",
    "ProxyEngine",
    "QuoteInput",
    "QuoteOptions",
    "QuoteRequest",
    "QuoteResult",
    "QuoteType",
    "QuoteV3Options",
    "QuoteV3Request",
    "QuotedPlan",
    "RateLimitError",
    "RawResponse",
    "ReadinessResult",
    "ReferenceDataResponse",
    "RemoteEngine",
    "ResolvedIsaOptions",
    "SessionAuth",
    "Sex",
    "UsageSummary",
    "V3Offer",
    "ValidationError",
    "Weight",
    "WeightParseError",
    "ZyInsClient",
    "ZyInsError",
    "by_amount",
    "coerce_plan_info",
    "resolve_isa_options",
    "title_case_label",
]
