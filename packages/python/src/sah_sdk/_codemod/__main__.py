"""CLI entry point: ``python -m sah_sdk._codemod``."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_CODEMOD_INSTALL_HINT = "pip install 'sah-sdk[codemod]'"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m sah_sdk._codemod",
        description="Rewrite isa_sdk.zyins.* imports to the sah_sdk surface.",
    )
    parser.add_argument("path", type=Path, help="root directory to walk")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report changes without writing files",
    )
    args = parser.parse_args(argv)

    if not args.path.exists():
        print(f"error: {args.path} does not exist", file=sys.stderr)
        return 2

    try:
        from .rewriter import rewrite_tree
    except ModuleNotFoundError as exc:
        if exc.name != "libcst":
            raise
        print(
            f"error: libcst is required for the codemod; install with {_CODEMOD_INSTALL_HINT}",
            file=sys.stderr,
        )
        return 2

    try:
        result = rewrite_tree(args.path, dry_run=args.dry_run)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for diag in result.diagnostics:
        print(f"{diag.file}: {diag.old} -> {diag.new}")
    print(
        f"scanned {result.files_scanned} file(s); {result.files_changed} would change"
        if args.dry_run
        else f"scanned {result.files_scanned} file(s); rewrote {result.files_changed}"
    )
    if args.dry_run and result.files_changed:
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
