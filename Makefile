
SNAP = https://cdn.openbsd.org/pub/OpenBSD/snapshots/amd64
SETS = base80 man80 comp80 game80 xshare80 xbase80 xserv80
TAR = tar

SRCS != echo *.html *.js

all: www.tgz

www.tgz: ${SRCS}
	tar cvzf $@ ${SRCS}

# Rebuild data.js from the OpenBSD snapshot man page sets: download
# missing sets into build/, extract the roff man pages, parse SEE ALSO
# references into graph edges, and precompute the layout.
# Requires python3, node/npm, curl, and GNU tar (use TAR=gtar on BSD).
data.js: tools/parse_roff.py tools/build_data.py tools/layout.js tools/package.json
	mkdir -p build/tree
	for t in ${SETS}; do \
		[ -f build/$$t.tgz ] || curl -sSf -o build/$$t.tgz ${SNAP}/$$t.tgz; \
		${TAR} -xzf build/$$t.tgz -C build/tree \
		    --wildcards '*/share/man/man*/*.*' '*/X11R6/man/man*/*.*' \
		    2>/dev/null || true; \
	done
	python3 tools/parse_roff.py build/tree build/pages.ndjson
	python3 tools/build_data.py build/pages.ndjson build/pages.ndjson.aliases data.js.tmp
	cd tools && npm install d3-force --no-audit --no-fund
	node tools/layout.js data.js.tmp data.js.tmp
	mv data.js.tmp data.js

tools/package.json:
	printf '{"name":"man-graph-tools","private":true}\n' > $@

publish: www.tgz
	ssh server tar xzvf - -C /var/www/htdocs/man/ < www.tgz

clean:
	rm -rf build
