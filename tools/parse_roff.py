#!/usr/bin/env python3
"""Parse extracted roff man pages: name, section, description, SEE ALSO refs.
Handles mdoc (.Sh/.Nd/.Xr/.Nm), man(7) (.SH/plain-text refs), and .so stubs."""
import json, os, re, sys

ROOT = sys.argv[1]
OUT = sys.argv[2]
SECS = {"1", "2", "3", "3p", "4", "5", "6", "7", "8", "9"}

RE_MAN_DIR = re.compile(r"man[0-9][a-z]?$")
RE_SH_NAME = re.compile(r"^\.(?:Sh|SH)[\s\\]+[\"']?NAME[\"']?[\s\\]*$", re.M)
RE_ND = re.compile(r"^\.Nd\s+(.+)$", re.M)
RE_SH_SEEALSO = re.compile(r"^\.(?:SH|Sh)\s+[\"']?SEE[\s\\]+ALSO[\"']?[\s\\]*$", re.M)
RE_SH_ANY = re.compile(r"^\.(?:SH|Sh)\b", re.M)
RE_Ss_ANY = re.compile(r"^\.(?:SS|Ss)\b", re.M)
RE_XR = re.compile(r"^\.Xr\s+(\S+)\s+(\S+)", re.M)
RE_NM = re.compile(r"^\.Nm\s+(.+)$", re.M)
RE_SO = re.compile(r"^\.so\s+(\S+)\s*$", re.M)
# plain-text refs: Name(sec) or NAME(sec), tolerate macro-splits like ".BR foo (3)"
RE_TXTREF = re.compile(r"\b([A-Za-z_][A-Za-z0-9_.:+-]{1,40})\s*\((\d[a-z]?)\)")
RE_REQ = re.compile(r"^[.'][A-Za-z]{1,2}\b")

files = {}
for dirpath, dirnames, filenames in os.walk(ROOT):
    d = os.path.basename(dirpath)
    parent = os.path.basename(os.path.dirname(dirpath))
    if RE_MAN_DIR.fullmatch(d):
        sec, is_arch = d[3:], False
    elif RE_MAN_DIR.fullmatch(parent):
        sec, is_arch = parent[3:], True
    else:
        continue
    if sec not in SECS:
        continue
    for fn in filenames:
        if "." not in fn:
            continue
        name, ext = fn.rsplit(".", 1)
        if ext != sec or not name:
            continue
        files.setdefault((name, sec), []).append((1 if is_arch else 0, os.path.join(dirpath, fn)))

def unquote(s):
    s = s.strip()
    if len(s) > 1 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return s.strip()

def unescape(s):
    s = re.sub(r"\\f\([A-Za-z]{1,2}", "", s)   # \f(CW \f(R
    s = re.sub(r"\\f[A-Za-z]", "", s)          # \fB \fP
    s = re.sub(r"\\\*\([A-Za-z]{2}", "", s)    # \*(Aq \*(Lq
    s = re.sub(r"\\\*", "", s)
    s = s.replace("\\&", "")
    return re.sub(r"\\(.)", r"\1", s)

def key_from_path(p):
    parts = p.split("/")[-1].rsplit(".", 1)
    if len(parts) == 2 and parts[1] in SECS:
        return (parts[0], parts[1])
    return None

def segment(text, start):
    ends = [e.start() for e in RE_SH_ANY.finditer(text, start) if e.start() > start]
    ends += [e.start() for e in RE_Ss_ANY.finditer(text, start) if e.start() > start]
    return text[start: min(ends) if ends else len(text)]

pages, aliases = {}, {}
nstub = 0
for (name, sec), paths in sorted(files.items()):
    text = open(sorted(paths)[0][1], encoding="utf-8", errors="replace").read()
    nonblank = [l for l in text.splitlines() if l.strip()]
    so = RE_SO.search(text)
    if so and len(nonblank) <= 2:
        t = key_from_path(so.group(1).lstrip("./").split("/")[-1])
        if t and t != (name, sec):
            aliases[f"{name}.{sec}"] = f"{t[0]}.{t[1]}"
            nstub += 1
            continue

    desc, refs, nms = "", [], []

    m = RE_ND.search(text)
    if m:
        desc = unescape(unquote(m.group(1)))[:200]

    mn = RE_SH_NAME.search(text)
    if mn:
        nameseg = segment(text, mn.end())
        for nm in RE_NM.findall(nameseg):
            nm = unescape(unquote(nm)).strip().rstrip(",();").strip()
            if nm and re.fullmatch(r"[^\s]+", nm):
                nms.append(nm)
        if not desc:
            prose = [l.strip() for l in nameseg.splitlines() if l.strip() and not RE_REQ.match(l)]
            if prose:
                first = unescape(re.sub(r"\s+", " ", " ".join(prose)))
                mm = re.match(rf"^{re.escape(nms[0] if nms else name)}\s+\\?-\s+(.+)$", first) or \
                     re.match(r"^\\?-\s+(.+)$", first)
                if not mm:
                    mm = re.search(r"\s\\?-\s(.+)$", first)
                if mm:
                    desc = mm.group(1).strip()[:200]

    m = RE_SH_SEEALSO.search(text)
    if m:
        seg = segment(text, m.end())
        for rn, rs in RE_XR.findall(seg):
            rn = unescape(unquote(rn))
            if rs in SECS and rn:
                refs.append([rn, rs])
        # plain-text refs (man(7) style): drop request tokens first
        flat = " ".join(re.sub(r"^[.'][A-Za-z]{1,2}\s+", "", l) for l in seg.splitlines())
        flat = unescape(flat)
        seen = {(r[0], r[1]) for r in refs}
        for rn, rs in RE_TXTREF.findall(flat):
            if rs in SECS and rn and rn.lower() != "section" and (rn, rs) not in seen:
                seen.add((rn, rs))
                refs.append([rn, rs])

    for nm in nms[1:]:
        ak = f"{nm}.{sec}"
        if ak not in aliases and (nm, sec) not in files:
            aliases[ak] = f"{name}.{sec}"
    pages[(name, sec)] = {"d": desc, "r": refs, "al": nms[1:]}

with open(OUT, "w", encoding="utf-8") as f:
    for (n, s), rec in sorted(pages.items()):
        f.write(json.dumps({"n": n, "s": s, "d": rec["d"], "r": rec["r"], "al": rec["al"]}, ensure_ascii=False) + "\n")
with open(OUT + ".aliases", "w", encoding="utf-8") as f:
    json.dump(aliases, f, ensure_ascii=False)

print(f"unique pages: {len(pages)}  stubs: {nstub}  total aliases: {len(aliases)}")
print(f"pages with SEE ALSO refs: {sum(1 for p in pages.values() if p['r'])}")
print(f"pages with desc: {sum(1 for p in pages.values() if p['d'])}")
