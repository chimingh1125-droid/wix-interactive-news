/* Core of the line-art renderer.
 *
 * Everything is immediate mode: each frame the scene functions push SVG
 * markup into a Builder, which becomes the page content. All randomness is
 * seeded, so any frame renders identically no matter which worker draws it.
 *
 * Hand-drawn look:
 *  - strokes are resampled polylines nudged along their normals by smooth
 *    noise whose seed changes every BOIL frames ("line boil"),
 *  - main strokes are brush ribbons with tapered ends,
 *  - a stroke's progress p (0..1) draws it on from its start point.
 * Occlusion: closed shapes are filled with the paper colour before their
 * outline, and components are drawn back-to-front.
 */
(function (G) {
  'use strict';
  const W = 1920, H = 1080, TAU = Math.PI * 2, DEG = Math.PI / 180;

  // ---------------------------------------------------------------- math
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = (t) => Math.pow(clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOutBack = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };
  const easeOutQuad = (t) => 1 - (1 - clamp(t)) * (1 - clamp(t));
  const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));
  // progress of an action that starts at t0 and lasts dur
  const prog = (t, t0, dur, ease = smooth) => ease(inv(t0, t0 + dur, t));

  function hash(i, seed) {
    let h = Math.imul((i | 0) ^ Math.imul(seed | 0, 0x27d4eb2d), 0x165667b1);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const rnd = (seed, i = 0) => hash(i * 7919 + 13, seed * 104729 + 7);
  const rrange = (seed, i, a, b) => a + (b - a) * rnd(seed, i);
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
  }
  // periodic variant for closed loops
  function noiseP(x, period, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const m = (k) => ((k % period) + period) % period;
    return lerp(hash(m(i), seed), hash(m(i + 1), seed), u) * 2 - 1;
  }
  const fbm = (x, seed = 0) => noise1(x, seed) * 0.65 + noise1(x * 2.13 + 11.7, seed + 3) * 0.35;

  // ------------------------------------------------------------ geometry
  const P = (x, y) => [x, y];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const len = (a) => Math.hypot(a[0], a[1]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const perp = (a) => [-a[1], a[0]];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const rot = (a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };
  const polar = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
  const rotAbout = (p, c, ang) => add(c, rot(sub(p, c), ang));

  function bez(p0, p1, p2, p3, n = 16) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  function qbez(p0, p1, p2, n = 12) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }
  function arc(c, r, a0, a1, n) {
    n = n || Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 10));
    const out = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    return out;
  }
  function ellipse(c, rx, ry, rotA = 0, n = 48, a0 = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + TAU * i / n;
      out.push(add(c, rot([Math.cos(a) * rx, Math.sin(a) * ry], rotA)));
    }
    return out;
  }
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  // Catmull-Rom spline through points (open), n samples per segment
  function spline(pts, n = 8, closed = false) {
    const out = [], m = pts.length;
    if (m < 3) return pts.slice();
    const get = (i) => closed ? pts[(i + m) % m] : pts[clamp(i, 0, m - 1)];
    const segs = closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                  0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    if (!closed) out.push(pts[m - 1]);
    return out;
  }
  function transformPts(pts, tx, ty, s = 1, ang = 0) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    return pts.map((p) => [tx + (p[0] * c - p[1] * sn) * s, ty + (p[0] * sn + p[1] * c) * s]);
  }
  const mirrorX = (pts, cx) => pts.map((p) => [2 * cx - p[0], p[1]]);

  function cumlen(pts) {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i], pts[i - 1]));
    return c;
  }
  function resample(pts, step, closed = false) {
    const src = closed ? pts.concat([pts[0]]) : pts;
    const c = cumlen(src), L = c[c.length - 1];
    if (L < 1e-6) return src.slice();
    const n = Math.max(2, Math.round(L / step));
    const out = [];
    let j = 0;
    const lim = closed ? n : n + 1;
    for (let i = 0; i < lim; i++) {
      const s = L * i / n;
      while (j < c.length - 2 && c[j + 1] < s) j++;
      const seg = c[j + 1] - c[j] || 1;
      out.push(mix(src[j], src[j + 1], (s - c[j]) / seg));
    }
    return out;
  }
  function normalsOf(pts, closed = false) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
      const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      out.push(norm(perp(sub(b, a))));
    }
    return out;
  }
  function cutPts(pts, p) {
    if (p >= 1) return pts;
    const c = cumlen(pts), L = c[c.length - 1] * clamp(p);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (c[i] >= L) {
        const seg = c[i] - c[i - 1] || 1;
        out.push(mix(pts[i - 1], pts[i], (L - c[i - 1]) / seg));
        return out;
      }
      out.push(pts[i]);
    }
    return out;
  }
  function pointAt(pts, p) {
    const c = cumlen(pts), L = c[c.length - 1] * clamp(p);
    for (let i = 1; i < pts.length; i++) {
      if (c[i] >= L) { const seg = c[i] - c[i - 1] || 1; return mix(pts[i - 1], pts[i], (L - c[i - 1]) / seg); }
    }
    return pts[pts.length - 1];
  }
  function tangentAt(pts, p) {
    const a = pointAt(pts, Math.max(0, p - 0.01)), b = pointAt(pts, Math.min(1, p + 0.01));
    return norm(sub(b, a));
  }
  const polyLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]); return L; };
  function bbox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  // -------------------------------------------------------- render state
  const R = {
    frame: 0, t: 0, boil: 0, BOIL: 3,
    amp: 1.25,         // wobble amplitude (px)
    pal: null,         // current palette
    lineScale: 1,      // global stroke width multiplier
  };
  const PALETTES = {
    day: {
      name: 'day', bg: '#a3171e', fill: '#a3171e', fillFar: '#a91f25', fillMid: '#a61b21', fillNear: '#9d141a',
      shade: '#8c1016', dark: '#6e0b10', line: '#fff3e2', soft: 'rgba(255,243,226,0.55)', faint: 'rgba(255,243,226,0.28)',
      gold: '#ebbb52', goldSoft: 'rgba(235,187,82,0.6)', glow: '#ffd98a', ink: '#fff3e2',
    },
    night: {
      name: 'night', bg: '#0d1830', fill: '#0d1830', fillFar: '#12203d', fillMid: '#0f1c36', fillNear: '#0b1429',
      shade: '#091124', dark: '#060c1a', line: '#e5493f', soft: 'rgba(229,73,63,0.6)', faint: 'rgba(229,73,63,0.32)',
      gold: '#f6bd55', goldSoft: 'rgba(246,189,85,0.6)', glow: '#ffbf5e', ink: '#e5493f',
    },
  };
  PALETTES.dawn = Object.assign({}, PALETTES.day, { name: 'dawn' });

  // ------------------------------------------------------------- output
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  function pathD(pts, closed = false) {
    if (!pts.length) return '';
    let s = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (let i = 1; i < pts.length; i++) s += 'L' + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return closed ? s + 'Z' : s;
  }
  // smooth path through points (Catmull-Rom converted to cubic Beziers)
  function smoothD(pts, closed = false, move = true) {
    const n = pts.length;
    if (n < 3) return pathD(pts, closed);
    const get = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    let s = move ? 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]) : '';
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      s += 'C' + f1(c1[0]) + ' ' + f1(c1[1]) + ' ' + f1(c2[0]) + ' ' + f1(c2[1]) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return closed ? s + 'Z' : s;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  class Builder {
    constructor() { this.a = []; this.uid = 0; }
    add(s) { this.a.push(s); return this; }
    open(attrs) { this.a.push('<g ' + (attrs || '') + '>'); return this; }
    close() { this.a.push('</g>'); return this; }
    id(prefix) { return (prefix || 'u') + (this.uid++); }
    str() { return this.a.join(''); }
  }

  // ------------------------------------------------------------ wobble
  // Offset points along their normals with smooth noise. `seed` identifies
  // the stroke, R.boil animates the noise in steps (hand-drawn line boil).
  function wobble(pts, amp, seed, closed = false, freq = 1 / 55) {
    if (amp <= 0 || pts.length < 2) return pts;
    const ns = normalsOf(pts, closed), c = cumlen(closed ? pts.concat([pts[0]]) : pts);
    const L = c[c.length - 1];
    const b = R.boil;
    const out = [];
    if (closed) {
      const period = Math.max(3, Math.round(L * freq));
      for (let i = 0; i < pts.length; i++) {
        const x = c[i] / L * period;
        const o = noiseP(x, period, seed * 31 + b * 7) * amp;
        out.push([pts[i][0] + ns[i][0] * o, pts[i][1] + ns[i][1] * o]);
      }
    } else {
      for (let i = 0; i < pts.length; i++) {
        const o = noise1(c[i] * freq + seed * 3.17, seed * 31 + b * 7) * amp;
        out.push([pts[i][0] + ns[i][0] * o, pts[i][1] + ns[i][1] * o]);
      }
    }
    return out;
  }
  // small jitter of a single point (for rigid props that should still boil)
  const jit = (p, seed, amp = 1) => [p[0] + noise1(seed * 1.7, R.boil * 13 + 1) * amp, p[1] + noise1(seed * 2.3, R.boil * 13 + 2) * amp];

  // Brush ribbon: filled outline around centerline q with width profile.
  function ribbonD(q, w, o) {
    const n = q.length;
    if (n < 2) return '';
    const c = cumlen(q), L = c[n - 1];
    const full = o.fullLen || L;
    const tin = o.taperIn === undefined ? Math.min(18, full * 0.25) : o.taperIn;
    const tout = o.taperOut === undefined ? Math.min(22, full * 0.3) : o.taperOut;
    const ns = normalsOf(q);
    const Ls = [], Rs = [];
    const seed = o.seed || 0;
    for (let i = 0; i < n; i++) {
      const s = c[i];
      let k = 1;
      if (tin > 0) k *= 0.3 + 0.7 * smooth(s / tin);
      if (tout > 0) k *= 0.25 + 0.75 * smooth((full - s) / tout);
      k *= 1 + 0.16 * noise1(s / 40 + seed, seed + 101);
      const hw = Math.max(0.35, w * k * 0.5);
      Ls.push([q[i][0] + ns[i][0] * hw, q[i][1] + ns[i][1] * hw]);
      Rs.push([q[i][0] - ns[i][0] * hw, q[i][1] - ns[i][1] * hw]);
    }
    const endHw = dist(Ls[n - 1], Rs[n - 1]) / 2, stHw = dist(Ls[0], Rs[0]) / 2;
    let s = smoothD(Ls, false);
    s += 'A' + f1(endHw) + ' ' + f1(endHw) + ' 0 0 1 ' + f1(Rs[n - 1][0]) + ' ' + f1(Rs[n - 1][1]);
    s += smoothD(Rs.slice().reverse(), false, false);
    s += 'A' + f1(stHw) + ' ' + f1(stHw) + ' 0 0 1 ' + f1(Ls[0][0]) + ' ' + f1(Ls[0][1]) + 'Z';
    return s;
  }

  // ------------------------------------------------------------ drawing
  // Open stroke. o: {p, w, color, seed, amp, step, brush, opacity, dash, cap}
  function stroke(d, pts, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0.001 || pts.length < 2) return;
    const step = o.step || 5;
    let q = resample(pts, step);
    const full = polyLen(q);
    q = wobble(q, o.amp === undefined ? R.amp : o.amp, o.seed || 0, false, o.freq);
    if (p < 1) q = cutPts(q, p);
    const color = o.color || R.pal.line;
    const w = (o.w || 3) * R.lineScale;
    const op = o.opacity === undefined ? 1 : o.opacity;
    if (op <= 0.001) return;
    const opa = op < 1 ? ' opacity="' + op.toFixed(3) + '"' : '';
    if (o.brush !== false && !o.dash) {
      d.add('<path d="' + ribbonD(q, w, { fullLen: full, seed: o.seed || 0, taperIn: o.taperIn, taperOut: p < 1 ? 0 : o.taperOut }) + '" fill="' + color + '"' + opa + (o.filter ? ' filter="' + o.filter + '"' : '') + '/>');
    } else {
      d.add('<path d="' + smoothD(q) + '" fill="none" stroke="' + color + '" stroke-width="' + f1(w) + '" stroke-linecap="' + (o.cap || 'round') + '" stroke-linejoin="round"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + opa + (o.filter ? ' filter="' + o.filter + '"' : '') + '/>');
    }
  }

  // Closed shape: fill (occluder) + outline stroke.
  // o: {p, fill, fillOpacity, w, color, seed, amp, start (0..1 outline start), noStroke, brush}
  function shape(d, pts, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0.001 || pts.length < 3) return;
    const step = o.step || 6;
    let q = resample(pts, step, true);
    q = wobble(q, o.amp === undefined ? R.amp : o.amp, o.seed || 0, true, o.freq);
    const fill = o.fill === undefined ? R.pal.fill : o.fill;
    if (fill && fill !== 'none') {
      // fill comes in quickly while the outline starts drawing
      const fo = (o.fillOpacity === undefined ? 1 : o.fillOpacity) * (o.fillP === undefined ? smooth(p / 0.18) : o.fillP);
      if (fo > 0.001) d.add('<path d="' + smoothD(q, true) + '" fill="' + fill + '"' + (fo < 1 ? ' fill-opacity="' + fo.toFixed(3) + '"' : '') + (o.fillFilter ? ' filter="' + o.fillFilter + '"' : '') + '/>');
    }
    if (o.noStroke) return;
    // outline as an open loop starting at `start`
    const k = Math.floor((o.start || 0) * q.length);
    const loop = q.slice(k).concat(q.slice(0, k + 1));
    const color = o.color || R.pal.line;
    const w = (o.w || 3) * R.lineScale;
    const lp = p >= 1 ? loop : cutPts(loop, p);
    if (o.brush) {
      d.add('<path d="' + ribbonD(lp, w, { fullLen: polyLen(loop), seed: o.seed || 0, taperIn: 6, taperOut: 6 }) + '" fill="' + color + '"' + (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + '/>');
    } else {
      d.add('<path d="' + smoothD(lp) + '" fill="none" stroke="' + color + '" stroke-width="' + f1(w) + '" stroke-linecap="round" stroke-linejoin="round"' + (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + '/>');
    }
  }

  // Straight segments with slight overshoot, like a pencil sketch of a box.
  function sketchLine(d, a, b, o = {}) {
    const ov = o.over === undefined ? 4 : o.over;
    const dir = norm(sub(b, a));
    stroke(d, [sub(a, mul(dir, ov * rnd(o.seed || 1, 1))), add(b, mul(dir, ov * rnd(o.seed || 1, 2)))], Object.assign({ brush: false, step: 8 }, o));
  }

  // Draws several strokes sequentially within progress p.
  function seqP(p, i, n, overlap = 0.3) {
    const span = 1 / (n - (n - 1) * overlap);
    const a = i * span * (1 - overlap);
    return clamp((p - a) / span);
  }

  // Chinese typeface: Iansui (芫荽) follows the Taiwan MOE standard glyph
  // forms. It ships a single weight, so bold is emulated with a thin outline
  // in the text colour (the browser's synthetic bold is far heavier);
  // ZH_BOLD is the outline width per px of font size that matches the ink of
  // a real bold weight.
  const ZH_FONT = "'Iansui', 'Noto Serif CJK TC', serif";
  const ZH_BOLD = 0.012;

  // text helper
  function text(d, str, x, y, o = {}) {
    const fam = o.font || ZH_FONT;
    const size = o.size || 40;
    const attrs = [
      'x="' + f1(x) + '"', 'y="' + f1(y) + '"',
      'font-family="' + fam.replace(/"/g, "'") + '"', 'font-size="' + size + '"',
      'fill="' + (o.color || R.pal.line) + '"',
      'text-anchor="' + (o.anchor || 'middle') + '"',
    ];
    if (o.weight && o.font) attrs.push('font-weight="' + o.weight + '"');
    if (o.italic) attrs.push('font-style="italic"');
    if (o.spacing) attrs.push('letter-spacing="' + o.spacing + '"');
    if (o.opacity !== undefined) attrs.push('opacity="' + o.opacity + '"');
    if (o.stroke) attrs.push('stroke="' + o.stroke + '" stroke-width="' + (o.strokeW || 2) + '" paint-order="stroke"');
    else if (!o.font && (o.weight || 400) >= 600) attrs.push('stroke="' + (o.color || R.pal.line) + '" stroke-width="' + (size * ZH_BOLD).toFixed(2) + '" stroke-linejoin="round"');
    if (o.transform) attrs.push('transform="' + o.transform + '"');
    if (o.baseline) attrs.push('dominant-baseline="' + o.baseline + '"');
    if (o.vertical) attrs.push('writing-mode="vertical-rl"');
    if (o.filter) attrs.push('filter="' + o.filter + '"');
    d.add('<text ' + attrs.join(' ') + '>' + esc(str) + '</text>');
  }

  // radial glow halo (cheap light bloom)
  function halo(d, c, r, color, op = 0.6) {
    if (op <= 0.001) return;
    d.add('<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '" fill="url(#halo-' + color + ')" opacity="' + op.toFixed(3) + '"/>');
  }

  // Layer transform for parallax camera. cam = {x, y, z}: world point (x, y)
  // is shown at the frame centre with zoom z. depth < 1 moves the layer less
  // (farther away), depth > 1 more (foreground).
  function camOpen(d, cam, depth = 1, extra = '') {
    const s = 1 + (cam.z - 1) * depth;
    const ex = W / 2 + (cam.x - W / 2) * depth, ey = H / 2 + (cam.y - H / 2) * depth;
    d.add('<g transform="translate(' + (W / 2) + ' ' + (H / 2) + ') scale(' + s.toFixed(5) + ') translate(' + f1(-ex) + ' ' + f1(-ey) + ')' + (extra ? ' ' + extra : '') + '">');
  }

  G.K = {
    W, H, TAU, DEG, clamp, lerp, inv, smooth, smoother, easeOut, easeIn, easeInOut, easeOutBack, easeOutQuad, pulse, prog,
    hash, rnd, rrange, noise1, noiseP, fbm,
    P, add, sub, mul, len, dist, norm, perp, mix, rot, polar, rotAbout, bez, qbez, arc, ellipse, rectPts, spline,
    transformPts, mirrorX, cumlen, resample, normalsOf, cutPts, pointAt, tangentAt, polyLen, bbox,
    R, PALETTES, f1, pathD, smoothD, esc, Builder, wobble, jit, ribbonD, stroke, shape, sketchLine, seqP, text, halo, camOpen,
    ZH_FONT, ZH_BOLD,
  };
})(typeof window !== 'undefined' ? window : globalThis);
