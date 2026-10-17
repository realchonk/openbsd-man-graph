/* OpenBSD man pages — SEE ALSO graph view */
(function () {
  "use strict";

  var DATA = window.__MAN_DATA__;
  var el = function (id) { return document.getElementById(id); };

  var SECS = Object.keys(DATA.sections).sort(function (a, b) {
    var o = ["1", "2", "3", "3p", "4", "5", "6", "7", "8", "9"];
    return o.indexOf(a) - o.indexOf(b);
  });
  var COLORS = {
    "1": "#f2a83b", "2": "#e05252", "3": "#3ec46d", "3p": "#26b8ac",
    "4": "#4f9cf0", "5": "#a06ee8", "6": "#e06ab0", "7": "#aab2c0",
    "8": "#e8e8e8", "9": "#4fc8e0"
  };
  var color = function (sec) { return COLORS[sec] || "#8b95a7"; };
  var radius = function (n) {
    return 1.6 + Math.min(13, Math.log2(n.deg + 1) * 1.55);
  };

  /* ----- node/link objects (positions precomputed offline, frozen) ----- */
  var allNodes = DATA.nodes.map(function (a, i) {
    return {
      id: i, name: a[0], sec: a[1], deg: a[2], desc: a[3] || "", aliases: a[4] || [],
      x: a[5], y: a[6], fx: a[5], fy: a[6],
      url: "https://man.openbsd.org/" + a[0] + "." + a[1]
    };
  });
  var allLinks = DATA.links.map(function (p) {
    return { source: p[0], target: p[1] };
  });

  /* search index */
  allNodes.forEach(function (n) {
    n.hay = (n.name + " " + n.aliases.join(" ") + " " + n.desc).toLowerCase();
  });

  /* adjacency for hover highlight */
  var adj = new Array(allNodes.length);
  allLinks.forEach(function (l) {
    (adj[l.source] = adj[l.source] || new Set()).add(l.target);
    (adj[l.target] = adj[l.target] || new Set()).add(l.source);
  });

  /* ----- state ----- */
  var activeSecs = new Set(SECS);
  var showOrphans = true;
  var hoverId = -1, selectedId = -1, curK = 1;

  /* ----- graph (layout is precomputed; no simulation runs) ----- */
  var loading = el("loading");
  var loadDone = false;
  function finishLoad() {
    if (loadDone) return;
    loadDone = true;
    Graph.zoomToFit(0, 80);
    loading.style.opacity = "0";
    setTimeout(function () { loading.style.display = "none"; }, 500);
  }

  var Graph = new ForceGraph(el("graph"))
    .backgroundColor("#0a0d13")
    .nodeRelSize(1)
    .nodeVal(function (n) { return radius(n) * radius(n); })
    .nodeLabel(nodeTooltip)
    .linkColor(linkColor)
    .linkWidth(0.35)
    .linkDirectionalParticles(0)
    .enableNodeDrag(false)
    .cooldownTicks(0)
    .onNodeHover(function (n) {
      hoverId = n ? n.id : -1;
      el("graph").style.cursor = n ? "pointer" : "grab";
    })
    .onNodeClick(openNode)
    .onBackgroundClick(clearSelection)
    .onZoom(function (t) { curK = t.k; })
    .onEngineStop(finishLoad)
    .nodeCanvasObjectMode(function () { return "replace"; })
    .nodeCanvasObject(drawNode);

  /* click-vs-drag guard */
  var downX = 0, downY = 0, moved = false;
  el("graph").addEventListener("pointerdown", function (e) {
    downX = e.clientX; downY = e.clientY; moved = false;
  });
  el("graph").addEventListener("pointermove", function (e) {
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) moved = true;
  });

  function openNode(n) {
    if (moved) return;
    window.open(n.url, "_blank", "noopener");
  }
  function clearSelection() { selectedId = -1; }

  function nodeTooltip(n) {
    var h = '<span class="tname">' + esc(n.name) + '</span><span class="tsec">(' + n.sec + ")</span>";
    if (n.desc) h += '<div class="tdesc">' + esc(n.desc) + "</div>";
    if (n.aliases && n.aliases.length) h += '<div class="tdesc">also: ' + esc(n.aliases.slice(0, 6).join(", ")) + (n.aliases.length > 6 ? ", \u2026" : "") + "</div>";
    h += '<div class="tmeta">' + n.deg + " SEE ALSO link" + (n.deg === 1 ? "" : "s") + " &middot; click to open</div>";
    return h;
  }
  function linkColor(l) {
    if (hoverId >= 0 && (l.source.id === hoverId || l.target.id === hoverId))
      return "rgba(242, 168, 59, 0.85)";
    if (selectedId >= 0 && (l.source.id === selectedId || l.target.id === selectedId))
      return "rgba(120, 200, 255, 0.7)";
    return "rgba(140, 155, 180, 0.13)";
  }

  function drawNode(n, ctx, gs) {
    var hi = hoverId >= 0 || selectedId >= 0;
    var inN = !hi || n.id === hoverId || n.id === selectedId ||
      (hoverId >= 0 && adj[hoverId] && adj[hoverId].has(n.id)) ||
      (selectedId >= 0 && adj[selectedId] && adj[selectedId].has(n.id));
    var r = radius(n);
    var cx = n.x, cy = n.y;
    var alpha = inN ? 1 : 0.1;

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = color(n.sec);
    ctx.fill();

    if (n.id === hoverId || n.id === selectedId) {
      ctx.lineWidth = 1.5 / gs;
      ctx.strokeStyle = n.id === selectedId ? "#7cc8ff" : "#ffffff";
      ctx.stroke();
    }

    var showLabel =
      n.id === hoverId || n.id === selectedId ||
      (inN && (
        (curK >= 1.5 && n.deg >= 25) ||
        (curK >= 2.2 && n.deg >= 8) ||
        (curK >= 3.2 && n.deg >= 2) ||
        (curK >= 5)
      ));
    if (showLabel) {
      var fs = 11 / gs;
      ctx.font = fs + "px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3 / gs;
      ctx.strokeStyle = "rgba(10,13,19,0.9)";
      var label = n.name + "(" + n.sec + ")";
      var ly = cy + r + 2 / gs;
      ctx.strokeText(label, cx, ly);
      ctx.fillStyle = hi && !inN ? "rgba(150,160,180,0.5)" : "rgba(225,232,244,0.95)";
      ctx.fillText(label, cx, ly);
    }
    ctx.globalAlpha = 1;
  }

  /* ----- filtering ----- */
  function currentData() {
    var ns = [], nsIds = new Set();
    for (var i = 0; i < allNodes.length; i++) {
      var n = allNodes[i];
      if (activeSecs.has(n.sec) && (showOrphans || n.deg > 0)) {
        ns.push(n); nsIds.add(n.id);
      }
    }
    var ls = [];
    for (var j = 0; j < allLinks.length; j++) {
      var l = allLinks[j];
      if (nsIds.has(l.source) && nsIds.has(l.target)) ls.push(l);
    }
    return { nodes: ns, links: ls };
  }

  function updateStats() {
    var d = Graph.graphData();
    el("stats").innerHTML =
      "<b>" + d.nodes.length.toLocaleString() + "</b> pages &middot; <b>" +
      d.links.length.toLocaleString() + "</b> SEE ALSO references";
  }

  function rebuild() {
    Graph.graphData(currentData());
    updateStats();
  }

  /* ----- legend ----- */
  var legend = el("legend");
  SECS.forEach(function (s) {
    var chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = '<span class="dot" style="background:' + color(s) + '"></span>' +
      s + ' <span class="cnt">' + DATA.sections[s].count.toLocaleString() + "</span>";
    chip.title = DATA.sections[s].label;
    chip.onclick = function () {
      if (activeSecs.has(s)) {
        if (activeSecs.size === 1) return;
        activeSecs.delete(s);
        chip.classList.add("off");
      } else {
        activeSecs.add(s);
        chip.classList.remove("off");
      }
      rebuild();
    };
    legend.appendChild(chip);
  });
  el("opt-orphans").onchange = function () {
    showOrphans = this.checked;
    rebuild();
  };

  /* ----- search ----- */
  var q = el("q"), results = el("results"), activeHit = -1, hits = [];

  function doSearch() {
    var s = q.value.trim().toLowerCase();
    activeHit = -1;
    if (s.length < 2) { results.style.display = "none"; results.innerHTML = ""; hits = []; return; }
    var starts = [], contains = [];
    for (var i = 0; i < allNodes.length && starts.length + contains.length < 200; i++) {
      var n = allNodes[i];
      var ni = n.name.toLowerCase();
      if (ni.indexOf(s) === 0) starts.push(n);
      else if (n.hay.indexOf(s) !== -1) contains.push(n);
    }
    hits = starts.concat(contains).slice(0, 12);
    if (!hits.length) { results.style.display = "none"; return; }
    var html = "";
    hits.forEach(function (n, i2) {
      var ds = n.desc ? " &mdash; " + esc(n.desc) : "";
      html += '<div class="hit" data-i="' + i2 + '">' +
        '<span class="dot" style="background:' + color(n.sec) + '"></span>' +
        '<span class="nm">' + esc(n.name) + '<span class="sec">(' + n.sec + ")</span></span>" +
        '<span class="ds">' + ds + "</span></div>";
    });
    results.innerHTML = html;
    results.style.display = "block";
    Array.prototype.forEach.call(results.children, function (c) {
      c.onmousedown = function (e) {
        e.preventDefault();
        selectNode(parseInt(c.getAttribute("data-i"), 10));
      };
    });
  }
  q.addEventListener("input", doSearch);
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      activeHit = e.key === "ArrowDown"
        ? Math.min(hits.length - 1, activeHit + 1)
        : Math.max(0, activeHit - 1);
      Array.prototype.forEach.call(results.children, function (c, i2) {
        c.classList.toggle("active", i2 === activeHit);
      });
    } else if (e.key === "Enter") {
      selectNode(activeHit >= 0 && hits[activeHit] ? activeHit : 0);
    } else if (e.key === "Escape") {
      results.style.display = "none";
      q.blur();
    }
  });
  q.addEventListener("blur", function () {
    setTimeout(function () { results.style.display = "none"; }, 150);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
  });

  function selectNode(hitIdx) {
    var n = hits[hitIdx];
    if (!n) return;
    selectedId = n.id;
    results.style.display = "none";
    if (!activeSecs.has(n.sec)) {
      activeSecs = new Set(SECS);
      Array.prototype.forEach.call(legend.children, function (c) { c.classList.remove("off"); });
      rebuild();
    }
    Graph.centerAt(n.x, n.y, 700);
    Graph.zoom(Math.max(curK, 3.4), 700);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ----- panel collapse ----- */
  el("collapse").onclick = function () {
    var p = el("panel");
    p.classList.toggle("collapsed");
    this.innerHTML = p.classList.contains("collapsed") ? "&#43;" : "&#8722;";
  };

  el("gen").textContent = "generated " + DATA.meta.generated;

  /* ----- go ----- */
  Graph.graphData(currentData());
  updateStats();
  finishLoad();
})();
