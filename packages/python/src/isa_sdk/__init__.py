"""``isa_sdk`` — cross-language naming alias for :mod:`sah_sdk`.

The TypeScript SDK ships as ``@isa-sdk/sdk``; the canonical Python
import path going forward is ``isa_sdk``. To avoid a hard rename break
during the transition, this package re-exports the entire ``sah_sdk``
public surface verbatim. Either spelling resolves to the same objects:

    >>> import sah_sdk, isa_sdk
    >>> isa_sdk.Isa is sah_sdk.Isa
    True

Submodules (``isa_sdk.zyins``, ``isa_sdk.core``, …) resolve to the
corresponding ``sah_sdk`` modules, so ``from isa_sdk.zyins import
Applicant`` resolves natively under both runtime and mypy.

The legacy ``sah_sdk`` import path remains supported for one minor
release; new code should prefer ``isa_sdk``. Sunset target: v0.7.0.
"""

from __future__ import annotations

import importlib
import pkgutil
import sys

from sah_sdk import *  # noqa: F403  (re-export public surface)
from sah_sdk import __all__ as _sah_all
from sah_sdk import __version__

_SUBMODULE_ALIASES = (
    "account",
    "catalog",
    "core",
    "proxy",
    "rapidsign",
    "webhooks",
    "zyins",
)


def _install_aliases() -> None:
    for name in _SUBMODULE_ALIASES:
        source = importlib.import_module(f"sah_sdk.{name}")
        target_name = f"{__name__}.{name}"
        sys.modules[target_name] = source
        setattr(sys.modules[__name__], name, source)

        source_path = getattr(source, "__path__", None)
        if source_path is None:
            continue

        for module_info in pkgutil.walk_packages(source_path, f"sah_sdk.{name}."):
            child = importlib.import_module(module_info.name)
            child_target = f"{__name__}.{module_info.name.removeprefix('sah_sdk.')}"
            sys.modules[child_target] = child


_install_aliases()

__all__ = [*_sah_all, "__version__"]
