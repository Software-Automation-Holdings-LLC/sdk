"""Cross-product constant enums shared by the SDK surface.

* :class:`ErrorCode` — the closed enum of ``error.code`` values the SDK
  asks consumers to match on (see SDK_DESIGN.md §6).
* :class:`UsState` — ISO 3166-2:US subdivision codes.
* :class:`ProductLabels` — human-readable labels for the zyins
  :class:`~sah_sdk.zyins.product.Product` enum. Kept here (not in
  ``zyins/``) because labels are a presentation concern shared across
  any namespace that displays a product (e.g. proxy passthrough UI).
"""

from __future__ import annotations

from enum import Enum
from types import MappingProxyType
from typing import Final

# Re-export the zyins Product enum from the package root for symmetry
# with the TypeScript surface (``import { Product } from
# '@software-automation-holdings-llc/sdk'``). Importing here would
# create a cycle (core ← zyins), so we keep the alias indirect: the
# top-level ``sah_sdk.__init__`` imports ``Product`` from
# ``sah_sdk.zyins.product`` directly.


class ErrorCode(str, Enum):
    """Machine-readable error codes returned in ``error.code``.

    Stable enum: never renamed once shipped. See SDK_DESIGN.md §6 and
    ``api/guides/errors.md`` for the per-code remediation table.
    """

    AUTH_ERROR = "auth_error"
    PERMISSION_DENIED = "permission_denied"
    VALIDATION_ERROR = "validation_error"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    IDEMPOTENCY_CONFLICT = "idempotency_conflict"
    RATE_LIMITED = "rate_limited"
    PREQUALIFY_ERROR = "prequalify_error"
    LICENSE_ERROR = "license_error"
    TRANSPORT_ERROR = "transport_error"
    INTERNAL_ERROR = "internal_error"


class UsState(str, Enum):
    """ISO 3166-2:US two-letter state codes (50 states + DC)."""

    AL = "AL"
    AK = "AK"
    AZ = "AZ"
    AR = "AR"
    CA = "CA"
    CO = "CO"
    CT = "CT"
    DC = "DC"
    DE = "DE"
    FL = "FL"
    GA = "GA"
    HI = "HI"
    ID = "ID"
    IL = "IL"
    IN = "IN"
    IA = "IA"
    KS = "KS"
    KY = "KY"
    LA = "LA"
    ME = "ME"
    MD = "MD"
    MA = "MA"
    MI = "MI"
    MN = "MN"
    MS = "MS"
    MO = "MO"
    MT = "MT"
    NE = "NE"
    NV = "NV"
    NH = "NH"
    NJ = "NJ"
    NM = "NM"
    NY = "NY"
    NC = "NC"
    ND = "ND"
    OH = "OH"
    OK = "OK"
    OR = "OR"
    PA = "PA"
    RI = "RI"
    SC = "SC"
    SD = "SD"
    TN = "TN"
    TX = "TX"
    UT = "UT"
    VT = "VT"
    VA = "VA"
    WA = "WA"
    WV = "WV"
    WI = "WI"
    WY = "WY"


# Human-readable labels for the zyins Product enum. Kept as an
# immutable mapping so consumers can't mutate the shared table at
# runtime.
_PRODUCT_LABELS: Final = {
    "senior-life": "Senior Life",
    "rop": "Return of Premium",
    "term-life": "Term Life",
    "whole-life": "Whole Life",
    "iul": "Indexed Universal Life",
    "final-expense": "Final Expense",
    "annuity": "Annuity",
}

ProductLabels: Final = MappingProxyType(_PRODUCT_LABELS)

__all__ = ["ErrorCode", "ProductLabels", "UsState"]
