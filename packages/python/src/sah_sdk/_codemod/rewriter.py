"""libcst transformer that rewrites legacy ``isa_sdk.zyins.*`` imports.

Mapping rules — see ``MIGRATION.md`` for the canonical table:

* ``isa_sdk.zyins.transport`` → ``sah_sdk.core.transport``
* ``isa_sdk.zyins.errors``    → ``sah_sdk.core.errors``
* ``isa_sdk.zyins.envelope``  → ``sah_sdk.core.envelope``
* ``isa_sdk.zyins.debug``     → ``sah_sdk.core.debug``
* ``isa_sdk.zyins.auth``      → ``sah_sdk.core.auth``
* ``isa_sdk.zyins`` (root)    → ``sah_sdk.zyins``
* ``isa_sdk`` (root)          → ``sah_sdk``

The rewriter is intentionally narrow: only ``from X import …`` and
``import X`` statements are touched. String literals, comments, and
runtime ``importlib.import_module`` calls are left alone (they would
trigger far too many false positives).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import libcst as cst

# (legacy dotted prefix, new dotted prefix). Order matters: more
# specific prefixes must come before less specific ones so that
# ``isa_sdk.zyins.transport`` is not rewritten as
# ``sah_sdk.zyins.transport`` by the shorter rule.
_PREFIX_MAP: tuple[tuple[str, str], ...] = (
    ("isa_sdk.zyins.transport", "sah_sdk.core.transport"),
    ("isa_sdk.zyins.errors", "sah_sdk.core.errors"),
    ("isa_sdk.zyins.envelope", "sah_sdk.core.envelope"),
    ("isa_sdk.zyins.debug", "sah_sdk.core.debug"),
    ("isa_sdk.zyins.auth", "sah_sdk.core.auth"),
    ("isa_sdk.zyins", "sah_sdk.zyins"),
    ("isa_sdk", "sah_sdk"),
)


def _rewrite_dotted(value: str) -> str | None:
    """Return the new dotted name, or ``None`` if no rule matched."""
    for legacy, new in _PREFIX_MAP:
        if value == legacy or value.startswith(legacy + "."):
            return new + value[len(legacy) :]
    return None


def _build_attribute(dotted: str) -> cst.BaseExpression:
    parts = dotted.split(".")
    node: cst.BaseExpression = cst.Name(parts[0])
    for part in parts[1:]:
        node = cst.Attribute(value=node, attr=cst.Name(part))
    return node


@dataclass
class Diagnostic:
    """A single rewriting decision recorded for reporting."""

    file: Path
    line: int
    old: str
    new: str


class IsaSdkImportRewriter(cst.CSTTransformer):
    """Rewrites legacy ``isa_sdk`` import statements to ``sah_sdk``."""

    def __init__(self) -> None:
        super().__init__()
        self.changes: list[Diagnostic] = []
        self._current_file: Path | None = None

    def set_file(self, path: Path) -> None:
        self._current_file = path

    # ------------------------------------------------------------------
    # ``from X import …``
    # ------------------------------------------------------------------
    def leave_ImportFrom(  # noqa: N802 — libcst-required visitor name
        self, _original: cst.ImportFrom, updated: cst.ImportFrom
    ) -> cst.ImportFrom:
        module = updated.module
        if module is None:
            return updated
        dotted = self._dotted(module)
        if dotted is None:
            return updated
        new_dotted = _rewrite_dotted(dotted)
        if new_dotted is None:
            return updated
        self._record(dotted, new_dotted)
        return updated.with_changes(module=_build_attribute(new_dotted))

    # ------------------------------------------------------------------
    # ``import X`` / ``import X as Y``
    # ------------------------------------------------------------------
    def leave_Import(  # noqa: N802 — libcst-required visitor name
        self, _original: cst.Import, updated: cst.Import
    ) -> cst.Import:
        new_aliases: list[cst.ImportAlias] = []
        changed = False
        for alias in updated.names:
            dotted = self._dotted(alias.name)
            new_dotted = _rewrite_dotted(dotted) if dotted else None
            if new_dotted is None or dotted is None:
                new_aliases.append(alias)
                continue
            self._record(dotted, new_dotted)
            new_aliases.append(alias.with_changes(name=_build_attribute(new_dotted)))
            changed = True
        if not changed:
            return updated
        return updated.with_changes(names=tuple(new_aliases))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _dotted(node: cst.BaseExpression) -> str | None:
        """Render a ``Name`` / ``Attribute`` chain back to a dotted string."""
        if isinstance(node, cst.Name):
            return node.value
        if isinstance(node, cst.Attribute):
            parent = IsaSdkImportRewriter._dotted(node.value)
            if parent is None:
                return None
            return f"{parent}.{node.attr.value}"
        return None

    def _record(self, old: str, new: str) -> None:
        path = self._current_file or Path("<unknown>")
        self.changes.append(Diagnostic(file=path, line=0, old=old, new=new))


# ---------------------------------------------------------------------------
# File / tree rewriting entry points
# ---------------------------------------------------------------------------


@dataclass
class RewriteResult:
    """Aggregate result of a tree-wide rewrite."""

    files_scanned: int = 0
    files_changed: int = 0
    diagnostics: list[Diagnostic] = field(default_factory=list)


def rewrite_file(path: Path, *, dry_run: bool = False) -> RewriteResult:
    """Rewrite a single ``.py`` file in place (or dry-run)."""
    source = path.read_text(encoding="utf-8")
    try:
        tree = cst.parse_module(source)
    except cst.ParserSyntaxError as exc:
        raise ValueError(f"{path}: failed to parse Python source: {exc}") from exc
    rewriter = IsaSdkImportRewriter()
    rewriter.set_file(path)
    new_tree = tree.visit(rewriter)
    result = RewriteResult(
        files_scanned=1,
        files_changed=1 if rewriter.changes else 0,
        diagnostics=rewriter.changes,
    )
    if rewriter.changes and not dry_run:
        path.write_text(new_tree.code, encoding="utf-8")
    return result


def rewrite_tree(root: Path, *, dry_run: bool = False) -> RewriteResult:
    """Recursively rewrite every ``.py`` file under ``root``."""
    total = RewriteResult()
    for path in sorted(root.rglob("*.py")):
        single = rewrite_file(path, dry_run=dry_run)
        total.files_scanned += single.files_scanned
        total.files_changed += single.files_changed
        total.diagnostics.extend(single.diagnostics)
    return total
