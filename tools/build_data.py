#!/usr/bin/env python3
"""Build final data.js: nodes = tarball pages + server extras, links = SEE ALSO refs,
references resolved through alias map (.so stubs + multi-name pages)."""
import json, sys
from collections import Counter

PAGES = sys.argv[1] if len(sys.argv) > 1 else "pages.ndjson"
ALIASES = sys.argv[2] if len(sys.argv) > 2 else "pages.ndjson.aliases"
OUT = sys.argv[3] if len(sys.argv) > 3 else "../data.js"

SECS = ["1", "2", "3", "3p", "4", "5", "6", "7", "8", "9"]
SEC_LABEL = {
    "1": "General Commands", "2": "System Calls", "3": "Library Functions",
    "3p": "Perl Library", "4": "Device Drivers", "5": "File Formats",
    "6": "Games", "7": "Miscellaneous", "8": "System Manager", "9": "Kernel Interfaces",
}
SECSET = set(SECS)

pages = {}
for line in open(PAGES):
    r = json.loads(line)
    pages[(r["n"], r["s"])] = {"d": r["d"], "r": r["r"], "al": r.get("al", [])}

aliases = json.load(open(ALIASES))

pages[("man.cgi", "8")] = {"d": "CGI program to search and display manual pages",
                           "r": [["apropos", "1"], ["makewhatis", "8"], ["mandoc.db", "5"], ["slowcgi", "8"]], "al": []}
pages.setdefault(("pkg_locate", "1"), {"d": "locating packages", "r": [], "al": []})

nodes = sorted(pages.keys(), key=lambda k: (SECS.index(k[1]), k[0]))
idx = {k: i for i, k in enumerate(nodes)}

def resolve(rn, rs):
    """Chase aliases; return node key or None."""
    k, hops = (rn, rs), 0
    while k not in pages and hops < 4:
        t = aliases.get(f"{k[0]}.{k[1]}")
        if not t:
            return None
        tn, _, ts = t.rpartition(".")
        k = (tn, ts)
        hops += 1
    return k if k in pages else None

edges = set()
unresolved = Counter()
for key, rec in pages.items():
    i = idx[key]
    for rn, rs in rec["r"]:
        if rs not in SECSET:
            continue
        j = idx.get((rn, rs))
        if j is None:
            k2 = resolve(rn, rs)
            if k2 is None:
                unresolved[(rn, rs)] += 1
                continue
            j = idx[k2]
        if i != j:
            edges.add((i, j) if i < j else (j, i))

deg = [0] * len(nodes)
for a, b in edges:
    deg[a] += 1
    deg[b] += 1

out = {
    "meta": {
        "generated": "2026-10-17",
        "source": "man.openbsd.org / OpenBSD-current snapshot man page sets",
        "nodes": len(nodes),
        "links": len(edges),
    },
    "sections": {s: {"label": SEC_LABEL[s], "count": sum(1 for _, x in nodes if x == s)} for s in SECS},
    "nodes": [[n, s, deg[i], pages[(n, s)]["d"], pages[(n, s)]["al"]] for i, (n, s) in enumerate(nodes)],
    "links": sorted(edges),
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.__MAN_DATA__ = ")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print(f"nodes: {len(nodes)}  links: {len(edges)}")
print("top degree:", sorted(((deg[i], nodes[i]) for i in range(len(nodes))), reverse=True)[:10])
print("unresolved refs:", sum(unresolved.values()), "unique:", len(unresolved), unresolved.most_common(5))
print("degree-0:", sum(1 for d in deg if d == 0), "by sec:", Counter(nodes[i][1] for i in range(len(nodes)) if deg[i] == 0))
