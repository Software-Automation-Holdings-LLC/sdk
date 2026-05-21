"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - insurance/v2_conditions.json
#   - insurance/v2_medications.json
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConditionCategoryMetadata:
    """Categories partition the canonical condition list into clinical groups.

    The engine's reference data does not currently expose a stable category
    taxonomy; this catalog is intentionally empty until the upstream
    publishes one. The shape is fixed so consumers can code against it today.
    """

    display_name: str
    conditions: tuple[str, ...]


_CATEGORIES: dict[str, ConditionCategoryMetadata] = {}
_ALL_CATEGORIES: tuple[str, ...] = ()


class _ConditionCategoriesAPI:
    __slots__ = ()

    def values(self) -> tuple[str, ...]:
        return _ALL_CATEGORIES

    def metadata(self, c: str) -> ConditionCategoryMetadata:
        m = _CATEGORIES.get(c)
        if m is None:
            raise KeyError(f"ConditionCategories.metadata: unknown category {c!r}")
        return m


ConditionCategories = _ConditionCategoriesAPI()
