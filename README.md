# OpenBSD man pages — graph view

An interactive graph of every OpenBSD manual page, connected by their
SEE ALSO sections. Clicking a page opens it at
`https://man.openbsd.org/name.section`.

- 5,550 man pages (sections 1, 2, 3, 3p, 4, 5, 6, 7, 8, 9, including
  X11 and perl pages, with per-architecture duplicates merged)
- 13,251 cross-references extracted from SEE ALSO sections
- 6,794 alias names resolved (`.so` stubs, multi-name `.Nm` pages such
  as `uhub -> usb(4)`, and man(7)-format pages with plain-text refs)

The layout is precomputed offline, so the page renders immediately.

Source code: <https://github.com/realchonk/openbsd-man-graph>

## Run

No build step and no server needed — open `index.html` directly, or:

    python3 -m http.server -d openbsd-man-graph

Everything is local and self-contained; man pages themselves are read
from man.openbsd.org when a node is clicked.

## Controls

| Action        | Result                                                  |
|---------------|---------------------------------------------------------|
| hover         | highlight a page and its SEE ALSO neighbors             |
| click         | open the page at man.openbsd.org/name.section (new tab) |
| `/`           | focus the search box (names, aliases, descriptions)     |
| chips         | toggle manual sections on/off                           |
| checkbox      | show/hide pages with no SEE ALSO links                  |
| drag / scroll | pan / zoom (labels appear as you zoom in)               |

## Files

    index.html          page shell and styles
    app.js              rendering, search, filtering
    data.js             nodes, links, descriptions, precomputed positions
    force-graph.min.js  vendored rendering library (MIT, vasturiano)
    tools/              scripts that produced data.js (see below)
    Makefile            build www.tgz and publish (make publish)

## Regenerating the data

Data is generated from the OpenBSD snapshot man page sets (the same
sources man.openbsd.org builds from), downloaded from
`https://cdn.openbsd.org/pub/OpenBSD/snapshots/amd64/`. One command:

    make data.js

This downloads missing sets into `build/`, extracts the roff man pages,
parses names/descriptions/SEE ALSO references/aliases, resolves the
graph edges, and precomputes the force-directed layout. Requires
python3, node/npm, curl, and GNU tar (on BSD: `make TAR=gtar data.js`).
Bump the set names (`base80`, `man80`, ...) in the Makefile when a new
OpenBSD snapshot or release comes out. `make clean` removes `build/`.

The steps individually, for reference:

    python3 tools/parse_roff.py build/tree build/pages.ndjson
    python3 tools/build_data.py build/pages.ndjson build/pages.ndjson.aliases data.js
    node tools/layout.js data.js data.js   # needs: cd tools && npm install d3-force

The layout step bakes x/y coordinates into `data.js`, which is why the
site loads without running a layout simulation in the browser. The
graph data is a snapshot of OpenBSD-current as of the date noted in the
UI.

## License

Site code and generated data: ISC (see LICENSE).
force-graph.min.js: MIT, Copyright (c) Vasco Asturiano.
Man page contents: Copyright the OpenBSD project, under their license terms.
