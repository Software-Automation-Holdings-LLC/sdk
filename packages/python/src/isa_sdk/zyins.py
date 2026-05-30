"""``isa_sdk.zyins`` — alias for :mod:`sah_sdk.zyins`.

Importing here is identical to importing from ``sah_sdk.zyins``; both
spellings yield the same module object via the parent package's
``sys.modules`` binding (see :mod:`isa_sdk`).
"""

from __future__ import annotations

from sah_sdk.zyins import *  # noqa: F403
from sah_sdk.zyins import (  # noqa: F401
    Applicant,
    Carrier,
    Condition,
    Coverage,
    CoverageType,
    Eligibility,
    Envelope,
    Height,
    HeightParseError,
    IsaApiError,
    IsaConfigError,
    IsaIdempotencyConflictError,
    IsaRateLimitError,
    Medication,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsage,
    NicotineUsageInput,
    PlanProduct,
    Premium,
    PrequalifyError,
    PrequalifyInput,
    PrequalifyPlan,
    PrequalifyResult,
    Product,
    ProductCatalog,
    ProductSelection,
    ProductType,
    QuoteInput,
    QuoteResult,
    QuoteType,
    RateLimitError,
    RawResponse,
    Sex,
    Weight,
    WeightParseError,
    ZyInsClient,
    ZyInsError,
)
