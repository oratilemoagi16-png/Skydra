#!/usr/bin/env python3
"""Report i18n key coverage: keys in en.json missing from each other locale."""
import json
import os
import sys

LOCALES = os.path.join(os.path.dirname(__file__), "..", "..", "src", "i18n", "locales")


def flat(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flat(v, key))
        else:
            out[key] = v
    return out


def main():
    en = flat(json.load(open(os.path.join(LOCALES, "en.json"))))
    print(f"| locale | missing keys | coverage |")
    print(f"|--------|--------------|----------|")
    worst = 0
    for f in sorted(os.listdir(LOCALES)):
        if f == "en.json":
            continue
        loc = flat(json.load(open(os.path.join(LOCALES, f))))
        missing = [k for k in en if k not in loc]
        worst = max(worst, len(missing))
        pct = 100 * (len(en) - len(missing)) / len(en)
        print(f"| {f[:-5]} | {len(missing)} | {pct:.1f}% |")
    sys.exit(1 if worst else 0)


if __name__ == "__main__":
    main()
