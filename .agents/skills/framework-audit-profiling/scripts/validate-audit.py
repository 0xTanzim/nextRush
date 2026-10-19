#!/usr/bin/env python3
"""Dependency-free structural validator for the generated .audit workspace."""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED = [
    "README.md", "00-plan.md", "01-evidence.md", "02-findings.md",
    "03-comparison.md", "04-experiments.md", "05-validation.md",
    "final-report.md", "run-manifest.json",
]
PLACEHOLDER_PATTERNS = [
    re.compile(r"<repo-root>|<title>|YYYY-MM-DD|\bTBD\b|\bTODO\b", re.IGNORECASE),
    re.compile(r"\|\s*\|\s*\|"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root (default: current directory)")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero for remaining template placeholders")
    args = parser.parse_args()
    audit = Path(args.root).resolve() / ".audit"
    errors: list[str] = []
    warnings: list[str] = []

    if not audit.is_dir():
        print(f"FAIL: audit directory does not exist: {audit}")
        return 2

    for name in REQUIRED:
        path = audit / name
        if not path.is_file():
            errors.append(f"missing required file: {name}")
            continue
        if path.stat().st_size == 0:
            errors.append(f"empty required file: {name}")

    manifest_path = audit / "run-manifest.json"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for key in ("created_utc", "status", "repository_root", "git_commit", "commands_run"):
                if key not in manifest:
                    errors.append(f"manifest missing key: {key}")
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(f"invalid run-manifest.json: {exc}")

    for name in REQUIRED:
        path = audit / name
        if not path.is_file() or path.suffix.lower() != ".md" or name == "README.md":
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern.search(content):
                warnings.append(f"template placeholders or empty table cells remain in {name}")
                break

    if errors:
        for item in errors:
            print(f"FAIL: {item}")
    if warnings:
        for item in sorted(set(warnings)):
            print(f"WARN: {item}")
    if not errors and not warnings:
        print("PASS: required .audit artifacts exist and manifest parses")
    else:
        print(f"Summary: {len(errors)} error(s), {len(set(warnings))} warning file(s)")

    if errors:
        return 2
    if warnings and args.strict:
        return 1
    print("NOTE: this checks record structure only, not technical correctness or measurement validity.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
