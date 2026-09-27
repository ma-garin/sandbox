// 関係図（Obsidian のグラフビュー相当）のブラウザ側。canvas に力学モデル（Barnes-Hut の反発＋ばね＋中心への引力＋冷却）で配置する。
// 描画は 30 fps 程度で、温度（alpha）が下がり切ったら requestAnimationFrame を止める。色は kit のトークンを getComputedStyle で読む。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。

export const TRACE_GRAPH_JS = String.raw`
var ALPHA_MIN = 0.004;
var ALPHA_DECAY = 0.03;
var FRAME_MS = 33;
var ALWAYS_LABEL = { folder: true, file: true, doc: true };
var LABEL_RANK = { doc: 0, folder: 1, file: 2, code: 3, section: 4 };
// 状態色（low/medium 等）は深刻度専用なので使わない。primary と中立色の濃淡で塗り、形でも区別する
var KIND_COLOR_VAR = { folder: '--color-text-secondary', file: '--color-border-strong', code: '--color-primary', doc: '--color-primary-dark', section: '--color-primary-light' };

function qNew(x, y, s) { return { x: x, y: y, s: s, leaf: true, pts: [], kids: null, m: 0, cx: 0, cy: 0 }; }

function qInsert(q, n, depth) {
  if (q.leaf) {
    if (q.pts.length === 0 || depth >= 24) { q.pts.push(n); return; }
    var pts = q.pts;
    q.pts = null; q.leaf = false; q.kids = [null, null, null, null];
    for (var i = 0; i < pts.length; i++) qChild(q, pts[i], depth);
  }
  qChild(q, n, depth);
}

function qChild(q, n, depth) {
  var h = q.s / 2;
  var i = (n.x >= q.x + h ? 1 : 0) + (n.y >= q.y + h ? 2 : 0);
  if (!q.kids[i]) q.kids[i] = qNew(q.x + (i & 1 ? h : 0), q.y + (i & 2 ? h : 0), h);
  qInsert(q.kids[i], n, depth + 1);
}

function qMass(q) {
  var m = 0, cx = 0, cy = 0;
  if (q.leaf) {
    q.pts.forEach(function (p) { m++; cx += p.x; cy += p.y; });
  } else {
    q.kids.forEach(function (k) { if (!k) return; qMass(k); m += k.m; cx += k.cx * k.m; cy += k.cy * k.m; });
  }
  q.m = m; q.cx = m ? cx / m : 0; q.cy = m ? cy / m : 0;
}

function qBuild(ns) {
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ns.forEach(function (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
  var root = qNew(x0, y0, Math.max(x1 - x0, y1 - y0) + 1);
  ns.forEach(function (n) { qInsert(root, n, 0); });
  qMass(root);
  return root;
}

function qRepel(q, n, k) {
  if (!q.m) return;
  var dx = q.cx - n.x, dy = q.cy - n.y, d2 = dx * dx + dy * dy;
  if (!q.leaf && (q.s * q.s) / Math.max(d2, 1e-9) < 0.81) { push(n, dx, dy, d2, q.m * k); return; }
  if (q.leaf) {
    q.pts.forEach(function (p) {
      if (p === n) return;
      var ex = p.x - n.x, ey = p.y - n.y;
      if (ex === 0 && ey === 0) { ex = (Math.random() - 0.5) * 0.1; ey = (Math.random() - 0.5) * 0.1; }
      push(n, ex, ey, ex * ex + ey * ey, k);
    });
    return;
  }
  q.kids.forEach(function (c) { if (c) qRepel(c, n, k); });
}

function push(n, dx, dy, d2, k) {
  var f = k / Math.max(d2, 16);
  n.vx -= dx * f; n.vy -= dy * f;
}

function createGraphView(canvas, onSelect) {
  var ctx = canvas.getContext('2d');
  var nodes = [], links = [], byId = new Map(), adj = new Map();
  var cam = { x: 0, y: 0, k: 1 }, W = 0, H = 0;
  var alpha = 0, raf = 0, lastFrame = 0, dirty = true, camTouched = false;
  var hover = null, hoverLink = null, selected = null, matches = new Set(), drag = null, colors = {};
  var edgeLabel = new Map();

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim() || 'gray'; }
    Object.keys(KIND_COLOR_VAR).forEach(function (k) { colors[k] = v(KIND_COLOR_VAR[k]); });
    colors.edge = v('--color-text-disabled'); colors.text = v('--color-text');
    colors.halo = v('--color-surface'); colors.sel = v('--color-primary');
  }

  function setData(gnodes, gedges) {
    var old = byId;
    var anchor = selected ? old.get(selected.id) : null;
    nodes = gnodes.map(function (g, i) {
      var p = old.get(g.id), a = i * 2.399963, r = 12 * Math.sqrt(i + 1);
      if (!p && anchor) return { id: g.id, g: g, x: anchor.x + Math.cos(a) * 30, y: anchor.y + Math.sin(a) * 30, vx: 0, vy: 0, deg: 0, fx: null, fy: null, r: 4 };
      return { id: g.id, g: g, x: p ? p.x : Math.cos(a) * r, y: p ? p.y : Math.sin(a) * r, vx: 0, vy: 0, deg: 0, fx: null, fy: null, r: 4 };
    });
    byId = new Map(nodes.map(function (n) { return [n.id, n]; }));
    adj = new Map(nodes.map(function (n) { return [n.id, new Set()]; }));
    links = [];
    edgeLabel = new Map();
    hoverLink = null;
    gedges.forEach(function (e) {
      var s = byId.get(e.from), t = byId.get(e.to);
      if (!s || !t || s === t) return;
      links.push({ s: s, t: t, kind: e.kind, label: e.label || '', w: e.weight ? Math.min(8, 1 + Math.sqrt(e.weight)) : 1 });
      if (e.label) [s.id + '\u0000' + t.id, t.id + '\u0000' + s.id].forEach(function (k) {
        var set = edgeLabel.get(k) || new Set();
        set.add(e.label);
        edgeLabel.set(k, set);
      });
      s.deg++; t.deg++;
      adj.get(s.id).add(t.id); adj.get(t.id).add(s.id);
    });
    nodes.forEach(function (n) { n.r = 3 + Math.min(12, Math.sqrt(n.deg) * 1.8); });
    hover = hover ? byId.get(hover.id) || null : null;
    if (selected) {
      var still = byId.get(selected.id) || null;
      selected = still;
      if (!still) onSelect(null);
    }
    reheat(old.size ? 0.5 : 1);
  }

  function tick() {
    if (!nodes.length) return;
    var tree = qBuild(nodes);
    nodes.forEach(function (n) { qRepel(tree, n, 70 * alpha); });
    links.forEach(function (l) {
      var dx = l.t.x + l.t.vx - l.s.x - l.s.vx, dy = l.t.y + l.t.vy - l.s.y - l.s.vy;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var len = l.kind === 'contains' ? 30 : 60;
      var f = (d - len) / d * alpha * (0.9 / Math.min(l.s.deg, l.t.deg));
      var b = l.s.deg / (l.s.deg + l.t.deg);
      l.t.vx -= dx * f * b; l.t.vy -= dy * f * b;
      l.s.vx += dx * f * (1 - b); l.s.vy += dy * f * (1 - b);
    });
    nodes.forEach(function (n) {
      n.vx -= n.x * 0.02 * alpha; n.vy -= n.y * 0.02 * alpha;
      if (n.fx !== null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; return; }
      n.vx *= 0.6; n.vy *= 0.6;
      n.x += n.vx; n.y += n.vy;
    });
    alpha += (0 - alpha) * ALPHA_DECAY;
  }

  function loop(ts) {
    raf = 0;
    if (ts - lastFrame < FRAME_MS) { raf = requestAnimationFrame(loop); return; }
    lastFrame = ts;
    var hot = alpha >= ALPHA_MIN || drag !== null;
    if (hot) {
      if (drag && drag.n) alpha = Math.max(alpha, 0.1);
      var steps = nodes.length < 1000 ? 3 : 1;
      for (var i = 0; i < steps; i++) tick();
      dirty = true;
      if (alpha < ALPHA_MIN && !camTouched) fit();
    }
    if (dirty) { draw(); dirty = false; }
    if (alpha >= ALPHA_MIN || drag !== null) raf = requestAnimationFrame(loop);
  }

  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function redraw() { dirty = true; kick(); }
  function reheat(a) { alpha = Math.max(alpha, a); kick(); }

  function toWorld(p) { return { x: (p.x - W / 2 - cam.x) / cam.k, y: (p.y - H / 2 - cam.y) / cam.k }; }
  function pos(ev) { var b = canvas.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; }

  function hit(p) {
    var w = toWorld(p), best = null, bestD = Infinity;
    nodes.forEach(function (n) {
      var dx = n.x - w.x, dy = n.y - w.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= n.r + 4 / cam.k && d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    var x = a.x + t * dx - p.x, y = a.y + t * dy - p.y;
    return Math.sqrt(x * x + y * y);
  }

  function hitLink(p) {
    var w = toWorld(p), best = null, bestD = 5 / cam.k;
    links.forEach(function (l) {
      if (!l.label) return;
      var d = segDist(w, l.s, l.t);
      if (d < bestD) { best = l; bestD = d; }
    });
    return best;
  }

  /** 線のラベル（C/R/U/D・イベント名など）は選択中の点の線とホバーした線にだけ小さく描く */
  function drawEdgeLabel(l) {
    var fs = 10 / cam.k, x = (l.s.x + l.t.x) / 2, y = (l.s.y + l.t.y) / 2;
    var label = l.label.length > 40 ? l.label.slice(0, 39) + '…' : l.label;
    ctx.globalAlpha = 1;
    ctx.font = fs + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3 / cam.k; ctx.strokeStyle = colors.halo; ctx.strokeText(label, x, y);
    ctx.fillStyle = colors.sel; ctx.fillText(label, x, y);
  }

  function focusSet() {
    if (!selected) return null;
    var s = new Set(adj.get(selected.id));
    s.add(selected.id);
    return s;
  }

  function drawNode(n, focus) {
    ctx.globalAlpha = focus && !focus.has(n.id) ? 0.12 : 1;
    ctx.fillStyle = colors[n.g.kind] || colors.edge;
    ctx.beginPath();
    shapePath(n);
    ctx.fill();
    if (n.g.kind === 'section') { ctx.lineWidth = 1.5 / cam.k; ctx.strokeStyle = colors.sel; ctx.stroke(); }
    if (n === selected || matches.has(n.id)) {
      ctx.lineWidth = 2.5 / cam.k; ctx.strokeStyle = colors.sel; ctx.stroke();
    }
  }

  /** 形: folder=角丸四角、file=四角、code=円、doc=ひし形、section=小さい円 */
  function shapePath(n) {
    var r = n.r, k = n.g.kind;
    if (k === 'folder' && typeof ctx.roundRect === 'function') ctx.roundRect(n.x - r, n.y - r, r * 2, r * 2, r * 0.45);
    else if (k === 'folder' || k === 'file') ctx.rect(n.x - r * 0.9, n.y - r * 0.9, r * 1.8, r * 1.8);
    else if (k === 'doc') { ctx.moveTo(n.x, n.y - r * 1.2); ctx.lineTo(n.x + r * 1.2, n.y); ctx.lineTo(n.x, n.y + r * 1.2); ctx.lineTo(n.x - r * 1.2, n.y); ctx.closePath(); }
    else ctx.arc(n.x, n.y, k === 'section' ? r * 0.7 : r, 0, Math.PI * 2);
  }

  /** 名前の優先順位: 選択・ホバー > 検索一致 > 選択の隣 > 文書 > フォルダ > ファイル > コード要素 > 節 */
  function labelRank(n, focus) {
    if (n === selected || n === hover) return 0;
    if (matches.has(n.id)) return 1;
    if (focus && focus.has(n.id)) return 2;
    return 3 + (LABEL_RANK[n.g.kind] || 0);
  }

  /** 名前は優先順に置き、先に置いた名前と重なるものは省く（選択・ホバー・検索一致は常に出す）。画面外の点は数えない */
  function drawLabels(focus) {
    var zoomed = cam.k >= 1.5, m = 160 / cam.k, fs = 12 / cam.k, pad = 3 / cam.k, cell = 100 / cam.k, grid = new Map();
    var a = toWorld({ x: 0, y: 0 }), z = toWorld({ x: W, y: H });
    var cand = nodes.filter(function (n) {
      if (n.x < a.x - m || n.x > z.x + m || n.y < a.y - m || n.y > z.y + m) return false;
      return ALWAYS_LABEL[n.g.kind] || zoomed || n === hover || n === selected || matches.has(n.id) || (focus && focus.has(n.id));
    }).map(function (n) { return { n: n, rank: labelRank(n, focus) }; });
    cand.sort(function (p, q) { return p.rank - q.rank || q.n.deg - p.n.deg; });
    function cells(b, fn) {
      for (var cx = Math.floor(b.x0 / cell); cx <= Math.floor(b.x1 / cell); cx++) {
        for (var cy = Math.floor(b.y0 / cell); cy <= Math.floor(b.y1 / cell); cy++) if (fn(cx + ',' + cy)) return true;
      }
      return false;
    }
    function overlaps(b) {
      return cells(b, function (k) {
        return (grid.get(k) || []).some(function (o) { return o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1; });
      });
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    cand.forEach(function (c) {
      var n = c.n, text = n.g.label.length > 60 ? n.g.label.slice(0, 59) + '…' : n.g.label;
      ctx.font = (n === hover || n === selected ? '600 ' : '') + fs + 'px system-ui, sans-serif';
      var w = ctx.measureText(text).width, top = n.y + n.r + 2 / cam.k;
      var b = { x0: n.x - w / 2 - pad, x1: n.x + w / 2 + pad, y0: top - pad, y1: top + fs * 1.2 + pad };
      if (c.rank > 1 && overlaps(b)) return;
      cells(b, function (k) { var l = grid.get(k); if (l) l.push(b); else grid.set(k, [b]); return false; });
      ctx.lineWidth = 3 / cam.k; ctx.strokeStyle = colors.halo; ctx.strokeText(text, n.x, top);
      ctx.fillStyle = colors.text; ctx.fillText(text, n.x, top);
    });
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
    var focus = focusSet();
    links.forEach(function (l) {
      var on = focus && (l.s === selected || l.t === selected);
      ctx.lineWidth = l.w / cam.k;
      ctx.globalAlpha = focus ? (on ? 0.85 : 0.04) : 0.16;
      ctx.strokeStyle = on ? colors.sel : colors.edge;
      ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
    });
    nodes.forEach(function (n) { drawNode(n, focus); });
    links.forEach(function (l) {
      if (l.label && (l === hoverLink || (selected && (l.s === selected || l.t === selected)))) drawEdgeLabel(l);
    });
    drawLabels(focus);
    ctx.globalAlpha = 1;
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    readColors();
    redraw();
  }

  function fit() {
    if (!nodes.length || !W || !H) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    nodes.forEach(function (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
    cam.k = Math.max(0.05, Math.min(3, Math.min(W / (x1 - x0 + 80), H / (y1 - y0 + 80))));
    cam.x = -(x0 + x1) / 2 * cam.k; cam.y = -(y0 + y1) / 2 * cam.k;
    redraw();
  }

  function centerOn(id) {
    var n = byId.get(id);
    if (!n) return;
    camTouched = true;
    if (cam.k < 1.2) cam.k = 1.2;
    cam.x = -n.x * cam.k; cam.y = -n.y * cam.k;
    redraw();
  }

  function select(id) {
    selected = id ? byId.get(id) || null : null;
    onSelect(selected ? selected.g : null);
    redraw();
  }

  canvas.addEventListener('pointerdown', function (ev) {
    canvas.setPointerCapture(ev.pointerId);
    var n = hit(pos(ev));
    drag = { n: n, sx: ev.clientX, sy: ev.clientY, cx: cam.x, cy: cam.y, moved: false };
    if (n) { n.fx = n.x; n.fy = n.y; }
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!drag) {
      var p = pos(ev), h = hit(p), hl = h ? null : hitLink(p);
      if (h !== hover || hl !== hoverLink) { hover = h; hoverLink = hl; canvas.style.cursor = h ? 'pointer' : 'grab'; redraw(); }
      return;
    }
    var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    if (drag.n) {
      var w = toWorld(pos(ev));
      drag.n.fx = w.x; drag.n.fy = w.y; drag.n.x = w.x; drag.n.y = w.y;
      reheat(0.1);
    } else {
      camTouched = true;
      cam.x = drag.cx + dx; cam.y = drag.cy + dy;
      redraw();
    }
  });
  function endDrag() {
    if (!drag) return;
    if (!drag.moved) select(drag.n ? drag.n.id : null);
    if (drag.n) { drag.n.fx = null; drag.n.fy = null; }
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function () { if ((hover || hoverLink) && !drag) { hover = null; hoverLink = null; redraw(); } });
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = pos(ev), w = toWorld(p);
    cam.k = Math.max(0.05, Math.min(8, cam.k * Math.exp(-ev.deltaY * 0.0015)));
    cam.x = p.x - W / 2 - w.x * cam.k; cam.y = p.y - H / 2 - w.y * cam.k;
    camTouched = true;
    redraw();
  }, { passive: false });
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);

  return {
    setData: setData, select: select, centerOn: centerOn, resize: resize,
    fit: function () { camTouched = false; fit(); },
    setMatches: function (ids) { matches = new Set(ids); redraw(); },
    neighbors: function (id) { return Array.from(adj.get(id) || []); },
    edgeLabels: function (a, b) { return Array.from(edgeLabel.get(a + '\u0000' + b) || []); },
    has: function (id) { return byId.has(id); },
  };
}
`;
