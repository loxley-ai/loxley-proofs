#!/usr/bin/env python3
"""Verify a LOXLEY nightwatch seal against a revealed day directory.

Usage: python3 verify.py <day-directory> <seal-file>
"""

import hashlib
import os
import sys


def compute(day_dir):
    h = hashlib.sha256()
    for name in sorted(os.listdir(day_dir)):
        with open(os.path.join(day_dir, name), "rb") as f:
            h.update(name.encode() + b"\x00" + f.read() + b"\x00")
    return h.hexdigest()


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    day_dir, seal_file = sys.argv[1], sys.argv[2]
    sealed = None
    with open(seal_file) as f:
        for line in f:
            if line.startswith("sha256:"):
                sealed = line.split(":", 1)[1].strip()
    if not sealed:
        print("no sha256 line found in seal file")
        sys.exit(2)
    actual = compute(day_dir)
    if actual == sealed:
        print(f"VALID. {actual}")
    else:
        print(f"INVALID.\n sealed: {sealed}\n actual: {actual}")
        sys.exit(1)


if __name__ == "__main__":
    main()
