"""Title Case label derivation + typed plan-info item.

Mirrors ``packages/ts/src/zyins/planInfoLabel.ts`` so consumers reading
both SDKs see identical Title-Case behavior for plan-info keys.

The post-zyins#349 wire shape carries a server-emitted ``label`` per
item — used verbatim. For pre-#349 bodies (legacy ``Record<string,
string[]>`` shape) the SDK upconverts to the typed array surface and
synthesizes a label by Title-Casing the snake_case key so downstream
UIs see exactly one type during the migration window.

Special-cases the well-known ``eapp`` token to ``eApp`` to match the
server's canonical capitalization. All other tokens follow the generic
"split on ``_`` / ``-``, capitalize each word" rule.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass

# Tokens whose canonical display form is NOT a simple capitalize. The TS
# implementation lists the same set; keep them in lock-step so a bug in
# one language translates to a bug in the other (i.e. the canonical
# spelling lives in one place per spec).
_SPECIAL_LABELS: Mapping[str, str] = {
    "eapp": "eApp",
    "url": "URL",
    "pdf": "PDF",
    "faq": "FAQ",
    "api": "API",
    "id": "ID",
    "eft": "EFT",
    "ach": "ACH",
    "ssn": "SSN",
}

_SPLIT_PATTERN = re.compile(r"[_\-]+")


def title_case_label(key: str) -> str:
    """Title-Case a snake_case / kebab-case plan-info key.

    Empty string in → empty string out. The server emits non-empty keys
    in practice; the empty-string guard exists so this function is safe
    to call on adversarial input from a malformed wire body.
    """
    if key == "":
        return ""
    parts = [part for part in _SPLIT_PATTERN.split(key) if part]
    return " ".join(_capitalize_word(part) for part in parts)


def _capitalize_word(word: str) -> str:
    lower = word.lower()
    special = _SPECIAL_LABELS.get(lower)
    if special is not None:
        return special
    return lower[0].upper() + lower[1:] if lower else lower


@dataclass(frozen=True, slots=True)
class PlanInfoItem:
    """One server-canonical entry in a plan's ``plan_info`` surface.

    ``key`` is the stable wire identifier (snake_case); ``label`` is the
    Title Case display string (server-emitted post-zyins#349, synthesized
    via :func:`title_case_label` on legacy bodies); ``values`` are the
    URL-decoded value strings in server-canonical display order.

    Iteration is stable — the wire array order is preserved exactly so
    rendering code can iterate without re-sorting.
    """

    key: str
    label: str
    values: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("PlanInfoItem: key must be a non-empty string")


def coerce_plan_info(raw: object) -> tuple[PlanInfoItem, ...]:
    """Coerce a wire ``plan_info`` field into the typed array surface.

    Accepts both wire shapes:

    * Post-zyins#349: ``list[{key, label, values}]`` — used verbatim.
    * Pre-zyins#349: ``dict[str, list[str]]`` — upconverted; labels are
      Title Cased from each key so consumers see one shape only.

    Values are preserved verbatim from the wire (URL-decoding is the
    server's responsibility post-#349; pre-#349 bodies pass through
    unchanged).

    Returns an empty tuple on any unrecognized shape — lenient by design
    so a forward-compatible field addition does not break parsing.
    """
    if isinstance(raw, list):
        items: list[PlanInfoItem] = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            key = entry.get("key")
            if not isinstance(key, str) or key == "":
                continue
            label_raw = entry.get("label")
            label = (
                label_raw
                if isinstance(label_raw, str) and label_raw != ""
                else title_case_label(key)
            )
            values_raw = entry.get("values")
            values_iterable = values_raw if isinstance(values_raw, list) else []
            values = tuple(v for v in values_iterable if isinstance(v, str))
            items.append(PlanInfoItem(key=key, label=label, values=values))
        return tuple(items)
    if isinstance(raw, dict):
        items = []
        for k, v in raw.items():
            if not isinstance(k, str) or k == "":
                continue
            values = tuple(x for x in (v if isinstance(v, list) else []) if isinstance(x, str))
            items.append(PlanInfoItem(key=k, label=title_case_label(k), values=values))
        return tuple(items)
    return ()
