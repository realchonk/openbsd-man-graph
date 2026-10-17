/* Precompute force-directed layout offline so the browser renders instantly. */
const fs = require("fs");
const d3 = require("d3-force");

const sandbox = { window: {} };
const DATA_PATH = process.argv[2] || "../data.js";
new Function("window", fs.readFileSync(DATA_PATH, "utf8"))(sandbox.window);
const DATA = sandbox.window.__MAN_DATA__;

const SECS = Object.keys(DATA.sections).sort(
  (a, b) => ["1", "2", "3", "3p", "4", "5", "6", "7", "8", "9"].indexOf(a) -
            ["1", "2", "3", "3p", "4", "5", "6", "7", "8", "9"].indexOf(b)
);

/* seed positions: same scheme the browser used (section anchors + jitter) */
let SEED = 42;
const rnd = () => { SEED = (SEED * 1103515245 + 12345) & 0x7fffffff; return SEED / 0x7fffffff; };
const anchors = {};
const CR = 760;
SECS.forEach((s, i) => {
  const a = (i / SECS.length) * Math.PI * 2 - Math.PI / 2;
  anchors[s] = { x: Math.cos(a) * CR, y: Math.sin(a) * CR };
});

const nodes = DATA.nodes.map((a, i) => {
  const c = anchors[a[1]] || { x: 0, y: 0 };
  return { id: i, sec: a[1], x: c.x + (rnd() - 0.5) * 500, y: c.y + (rnd() - 0.5) * 500 };
});
const links = DATA.links.map(([a, b]) => ({ source: a, target: b }));

/* section gravity (same constants as the old in-browser force) */
let gNodes;
const sectionGravity = alpha => {
  for (const n of gNodes) {
    const c = anchors[n.sec];
    if (!c) continue;
    n.vx += (c.x - n.x) * 0.055 * alpha;
    n.vy += (c.y - n.y) * 0.055 * alpha;
  }
};
sectionGravity.initialize = ns => { gNodes = ns; };

const sim = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(46).strength(0.65))
  .force("charge", d3.forceManyBody().strength(-58).theta(0.95))
  .force("section", sectionGravity)
  .velocityDecay(0.32)
  .stop();

const t0 = Date.now();
let ticks = 0;
while (sim.alpha() > 0.001 && ticks < 2000) { sim.tick(); ticks++; }
console.log(`layout: ${ticks} ticks in ${Date.now() - t0}ms (alpha ${sim.alpha().toFixed(4)})`);

/* extent sanity */
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (const n of nodes) {
  if (!isFinite(n.x) || !isFinite(n.y)) throw new Error("non-finite position at " + n.id);
  minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
  minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
}
console.log(`extent: x [${minX.toFixed(0)}, ${maxX.toFixed(0)}] y [${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);

/* write final data.js with positions appended: [name, sec, deg, desc, aliases, x, y] */
const out = {
  meta: DATA.meta,
  sections: DATA.sections,
  nodes: DATA.nodes.map((a, i) => [...a, +nodes[i].x.toFixed(1), +nodes[i].y.toFixed(1)]),
  links: DATA.links,
};
const OUT_PATH = process.argv[3] || DATA_PATH;
fs.writeFileSync(OUT_PATH,
  "window.__MAN_DATA__ = " + JSON.stringify(out) + ";\n");
const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
console.log(`data.js rewritten: ${kb}KB, nodes ${out.nodes.length}, links ${out.links.length}`);
