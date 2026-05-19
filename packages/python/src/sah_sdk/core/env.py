"""Environment-variable facade.

System boundaries (process env) go through an injectable facade so
tests can replace the lookup without monkey-patching ``os.environ``
and so the rest of the SDK never imports ``os`` directly.

Each factory in :mod:`.isa` consults :func:`get_env` for its defaults;
a missing value raises :class:`IsaConfigError` with a clear, actionable
message that names the env var the caller needs to set.
"""

from __future__ import annotations

import os
from typing import Protocol


class EnvReader(Protocol):
    """Minimal contract for environment-variable lookup."""

    def get(self, key: str) -> str | None: ...


class OsEnvReader:
    """Default :class:`EnvReader` backed by ``os.environ``.

    Empty strings are treated as missing — an env var that is set but
    empty is indistinguishable from one the operator forgot to populate
    and should fail with the same actionable error.
    """

    def get(self, key: str) -> str | None:
        value = os.environ.get(key)
        if value is None or value == "":
            return None
        return value


_default_reader: EnvReader = OsEnvReader()


def default_env() -> EnvReader:
    """Return the process-wide default :class:`EnvReader`."""
    return _default_reader


class IsaConfigError(Exception):
    """Configuration is missing or invalid at SDK construction time.

    Raised by the factory methods on :class:`~.isa.Isa` when a required
    env var is unset, or when an explicit argument fails the same
    validation the env-var path would.
    """

    def __init__(self, message: str, *, missing_env: tuple[str, ...] = ()) -> None:
        super().__init__(message)
        self.missing_env = missing_env


def require_env(env: EnvReader, key: str, *, factory_name: str) -> str:
    """Read ``key`` from ``env`` or raise :class:`IsaConfigError`.

    The error message names both the factory and the env var so the
    consumer immediately sees what to set.
    """
    value = env.get(key)
    if value is None:
        raise IsaConfigError(
            f"{factory_name}: required env var {key!r} is not set; "
            f"either pass the value explicitly or export {key} in the environment",
            missing_env=(key,),
        )
    return value
