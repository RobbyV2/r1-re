#!/usr/bin/env python3
"""
Build a navigable file/folder hierarchy from a libapp.so strings dump.

Strategy: parse the strings file, identify Dart `package:foo/bar/baz.dart`
references, group every other string by the *closest preceding* package
reference (since AOT keeps related strings near each other in the rodata
section). Synthesize a directory tree mirroring the package layout, with
one .txt per .dart file containing all symbols & strings attributed to it.

Not a true decompile — Blutter does that — but instantly navigable while
Blutter is building.
"""
from __future__ import annotations
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

PKG_RE = re.compile(r"^package:([a-z0-9_]+)/(.+\.dart)\b")
NOISE_PREFIXES = ("__", "_$", "_Z", ".L", "_LIBC", "vtable for", "typeinfo")


def looks_like_symbol(s: str) -> bool:
    if not s or len(s) < 3:
        return False
    if any(s.startswith(p) for p in NOISE_PREFIXES):
        return False
    if any(c in s for c in ("\x00", "\x01")):
        return False
    return True


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: strings_to_tree.py <strings-file> <out-dir>")
        return 1
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    if not src.exists():
        print(f"missing: {src}")
        return 1
    out.mkdir(parents=True, exist_ok=True)

    bucket_by_file: dict[tuple[str, str], list[str]] = defaultdict(list)
    pkg_seen: set[tuple[str, str]] = set()

    cur: tuple[str, str] | None = None
    window: list[str] = []
    WINDOW_SIZE = 60  # how many strings *before* a package marker to retroactively attribute

    with src.open("r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.rstrip("\n")
            m = PKG_RE.match(line)
            if m:
                cur = (m.group(1), m.group(2))
                pkg_seen.add(cur)
                # flush the trailing window into the new bucket
                bucket_by_file[cur].extend(window)
                window.clear()
                continue
            if not looks_like_symbol(line):
                continue
            if cur is not None:
                bucket_by_file[cur].append(line)
            else:
                window.append(line)
                if len(window) > WINDOW_SIZE:
                    window.pop(0)

    # Write one file per (package, dart_file)
    for (pkg, dart), lines in bucket_by_file.items():
        # Drop dupes while preserving order
        seen: set[str] = set()
        uniq: list[str] = []
        for l in lines:
            if l in seen:
                continue
            seen.add(l)
            uniq.append(l)
        target = out / pkg / (dart + ".txt")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("\n".join(uniq) + "\n", encoding="utf-8")

    # Top-level index of which packages we found
    (out / "_INDEX.txt").write_text(
        "\n".join(f"{p}/{d}" for p, d in sorted(pkg_seen)) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(bucket_by_file)} files across {len(set(p for p, _ in bucket_by_file))} packages to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
