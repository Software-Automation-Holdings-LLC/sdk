"""Pluggable source for the v3 reference bundle.

The reference layer (``conditions.match`` / ``medications.match`` /
autocomplete / fuzzy / autocorrect) is warmed by default from a live
``get_datasets_v3(...)`` HTTP call. A :class:`DatasetSource` lets the same
layer load from a local artifact — offline, inside the engine, or anywhere
a network round-trip is undesirable. The contract is a single
``load() -> DatasetBundleV3``; how the bytes arrive is the source's
business.

Three implementations ship:

* :class:`FileDatasetSource` — read a file, parse with the EXISTING
  :func:`parse_datasets_v3_envelope` (no second parser).
* :class:`ApiDatasetSource` — the current ``get_datasets_v3`` HTTP path.
* :class:`ResolvingDatasetSource` — try sources in order, first success
  wins. Documented chain: local file -> optional generate hook -> API.

Default behavior is unchanged: with no source the SDK uses the API path
exactly as before.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable

from .datasets_v3 import DatasetBundleV3, parse_datasets_v3_envelope

__all__ = [
    "ApiDatasetSource",
    "DatasetSource",
    "DatasetSourceError",
    "FileDatasetSource",
    "FileReader",
    "OnMissingHook",
    "ResolvingDatasetSource",
    "StaticDatasetSource",
    "to_dataset_source",
]


class DatasetSourceError(RuntimeError):
    """Raised when a :class:`DatasetSource` cannot resolve a bundle."""


@runtime_checkable
class DatasetSource(Protocol):
    """A source the reference layer can load a :class:`DatasetBundleV3` from."""

    def load(self) -> DatasetBundleV3:
        """Resolve the bundle.

        Raises :class:`DatasetSourceError` naming the source and the
        failing input when the bundle cannot be produced.
        """
        ...


#: Reads a file's text by path. Injectable so the file source stays
#: testable without touching the disk. The name describes WHAT (read a
#: file) not HOW (which API backs it).
FileReader = Callable[[str], str]


def _default_file_reader(path: str) -> str:
    """Read UTF-8 text via :class:`pathlib.Path`.

    The single filesystem call is isolated behind the injectable
    :data:`FileReader` facade so every other code path stays testable
    without disk I/O.
    """
    return Path(path).read_text(encoding="utf-8")


@dataclass(frozen=True, slots=True)
class FileDatasetSource:
    """Load the bundle from a local file via the shared parser.

    Accepts the slim ``reference-bundle.json`` OR the full
    ``datasets.json`` — both carry the same ``data.datasets`` shape; the
    reference layer reads only the reference fields. The file has no
    ETag, so the parsed bundle's ``etag`` is ``None``.
    """

    path: str
    read_file: FileReader = _default_file_reader

    def load(self) -> DatasetBundleV3:
        try:
            body = self.read_file(self.path)
        except OSError as err:
            raise DatasetSourceError(
                f"FileDatasetSource: failed to read {self.path}: {err}"
            ) from err
        try:
            return parse_datasets_v3_envelope(body, etag=None)
        except (ValueError, KeyError, TypeError) as err:
            raise DatasetSourceError(
                f"FileDatasetSource: failed to parse {self.path} as a v3 dataset bundle: {err}"
            ) from err


@dataclass(frozen=True, slots=True)
class ApiDatasetSource:
    """Load the bundle from a caller-supplied fetcher — the API path.

    Uses the already-configured client credential; it introduces no new
    service key. The fetcher is typically ``get_datasets_v3`` bound to a
    client context.
    """

    fetch: Callable[[], DatasetBundleV3]

    def load(self) -> DatasetBundleV3:
        return self.fetch()


@dataclass(frozen=True, slots=True)
class StaticDatasetSource:
    """Serve a bundle already in memory."""

    bundle: DatasetBundleV3

    def load(self) -> DatasetBundleV3:
        return self.bundle


#: Invoked between the first source's failure and the next source in a
#: :class:`ResolvingDatasetSource` chain.
OnMissingHook = Callable[[], None]


@dataclass(frozen=True, slots=True)
class ResolvingDatasetSource:
    """Try each source in order; the first that resolves wins.

    The documented chain is local file -> optional generate hook -> API
    fallback: pass the generate hook as ``on_missing`` and it runs once,
    after the first source fails and before the next is tried. When every
    source fails, :meth:`load` raises a :class:`DatasetSourceError` naming
    each attempt.
    """

    sources: Sequence[DatasetSource]
    on_missing: OnMissingHook | None = None

    def __post_init__(self) -> None:
        if not self.sources:
            raise DatasetSourceError(
                "ResolvingDatasetSource: at least one source is required"
            )

    def load(self) -> DatasetBundleV3:
        failures: list[str] = []
        for index, source in enumerate(self.sources):
            try:
                return source.load()
            except Exception as err:
                failures.append(f"{type(source).__name__} failed ({err})")
            if index == 0 and self.on_missing is not None:
                self._run_on_missing(failures)
        raise DatasetSourceError(
            "ResolvingDatasetSource: every source failed — " + "; ".join(failures)
        )

    def _run_on_missing(self, failures: list[str]) -> None:
        hook = self.on_missing
        if hook is None:
            return
        try:
            hook()
        except Exception as err:
            failures.append(f"on_missing hook failed ({err})")


def to_dataset_source(value: DatasetSource | DatasetBundleV3 | str) -> DatasetSource:
    """Normalize a source shorthand into a :class:`DatasetSource`.

    A ``str`` becomes a :class:`FileDatasetSource`; an in-memory
    :class:`DatasetBundleV3` becomes a :class:`StaticDatasetSource`; an
    already-built source passes through.
    """
    if isinstance(value, str):
        return FileDatasetSource(value)
    if isinstance(value, DatasetSource):
        return value
    return StaticDatasetSource(value)
