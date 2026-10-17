# AGENTS.md

Static site: every OpenBSD man page as an interactive graph, edges from
SEE ALSO sections, click-through to man.openbsd.org. No framework, no
build step for the site itself.

## Layout

    index.html          UI shell (element IDs are used by app.js)
    app.js              all logic: rendering, search, filters (ES5 style, keep it)
    data.js             GENERATED — never hand-edit
    force-graph.min.js  vendored third-party lib (MIT) — never edit
    tools/              data pipeline scripts (parse_roff.py, build_data.py,
                        layout.js + package.json for d3-force)
    Makefile            POSIX make only — no pattern rules, .PHONY, or ?=

## Commands

    make data.js      # rebuild data from OpenBSD snapshot sets
                      # (downloads into build/; needs python3, node/npm,
                      # curl, GNU tar; TAR=gtar on BSD)
    make www.tgz      # package the site files
    make publish      # deploy www.tgz to the server (ssh)
    make clean        # remove build/

Verify JS changes (no test suite exists):

    node --check app.js

Preview: open index.html directly, or
`python3 -m http.server -d openbsd-man-graph`.

## data.js format

`window.__MAN_DATA__` = { meta, sections, nodes, links }.
Node arrays: `[name, section, degree, description, aliases[], x, y]`.
x/y are precomputed layout coordinates (pinned via fx/fy in app.js).
Links are `[srcIdx, dstIdx]` pairs into the nodes array.

## Gotchas

- **Rendering is paused when idle.** force-graph only repaints on
  pan/zoom or while the simulation runs; the layout is frozen, so the
  engine never runs. Any feature that changes visuals outside pan/zoom
  (hover, selection, filters) must call `nudge()` in app.js, or the
  canvas will not update.
- **No live simulation.** Positions are baked in by `tools/layout.js`.
  If the graph data changes, re-run `make data.js` (layout step is
  deterministic and included).
- **Aliases are collapsed**: `.so` stubs and multi-name pages
  (e.g. `uhub` -> `usb(4)`) resolve to one canonical node; aliases stay
  searchable and appear in the tooltip. References are resolved through
  the alias map in `tools/build_data.py`.
- **Don't crawl man.openbsd.org in parallel** — it rate-limits
  aggressively. The pipeline uses the official snapshot tarballs from
  cdn.openbsd.org instead.
- Bump the `SETS` names in the Makefile (base80, man80, ...) when a new
  OpenBSD release/snapshot comes out.
